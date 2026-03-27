package main

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/signal"
	"strings"
	"sync" // Untuk menghindari concurrent write panic
	"syscall" // Untuk mendeteksi Kill PID
	"time"

	"github.com/gorilla/websocket"
)

// Struktur Konfigurasi
type Config struct {
	URL   string `json:"url"`
	Token string `json:"token"`
}

// Struktur Data dari Backend
type HeaderItem struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type FormDataPart struct {
	Type     string `json:"type"`
	Key      string `json:"key"`
	Value    string `json:"value"`
	Filename string `json:"filename"`
	Buffer   string `json:"buffer"` // Base64
}

type AgentMessage struct {
	Type              string         `json:"type"`
	ID                string         `json:"id"`
	Method            string         `json:"method"`
	URL               string         `json:"url"`
	HeadersStr        string         `json:"headersStr"`
	BodyType          string         `json:"bodyType"`
	BodyContent       string         `json:"bodyContent"`
	UrlEncodedEntries string         `json:"urlencodedEntries"`
	FormDataParts     []FormDataPart `json:"formDataParts"`
}

type AgentResponse struct {
	Type       string            `json:"type"`
	ID         string            `json:"id"`
	Status     int               `json:"status"`
	StatusText string            `json:"statusText"`
	Headers    map[string]string `json:"headers"`
	Data       interface{}       `json:"data"`
	Time       int64             `json:"time"`
}

const (
	configFileName = "config.json"
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
)

func main() {
	fmt.Println("========================================")
	fmt.Println("🚀 Rest Flow Local Agent Tunnel")
	fmt.Println("========================================")

	urlFlag := flag.String("url", "", "Rest Flow Backend URL (e.g. https://domain.com)")
	tokenFlag := flag.String("token", "", "Your Secret Tunnel Token")
	flag.Parse()

	config := loadConfig()

	if *urlFlag != "" { config.URL = *urlFlag }
	if *tokenFlag != "" { config.Token = *tokenFlag }

	needsSave := false
	reader := bufio.NewReader(os.Stdin)

	if config.URL == "" {
		fmt.Print("Enter Rest Flow URL (e.g. https://your-domain.com): ")
		input, _ := reader.ReadString('\n')
		config.URL = strings.TrimSpace(input)
		needsSave = true
	}

	if config.Token == "" {
		fmt.Print("Enter your Secret Tunnel Token: ")
		input, _ := reader.ReadString('\n')
		config.Token = strings.TrimSpace(input)
		needsSave = true
	}

	if config.URL == "" || config.Token == "" {
		log.Fatal("❌ URL and Token are required to start the agent.")
	}

	if needsSave {
		saveConfig(config)
		fmt.Println("✅ Configuration saved to config.json")
	}

	wsURL := formatWebSocketURL(config.URL, config.Token)

	// ==========================================
	// INFINITE LOOP UNTUK AUTO-RESTART
	// ==========================================
	for {
		fmt.Printf("🔄 Connecting to %s...\n", config.URL)
		shouldRestart := connectAndListen(wsURL)
		
		if !shouldRestart {
			// Berhenti karena di stop manual (Ctrl+C / Kill)
			break
		}
		
		fmt.Println("⏳ Retrying connection in 5 seconds...")
		time.Sleep(5 * time.Second)
	}
	
	fmt.Println("👋 Agent exited successfully.")
}

func formatWebSocketURL(baseURL, token string) string {
	u, err := url.Parse(baseURL)
	if err != nil {
		log.Fatalf("❌ Invalid URL format: %v", err)
	}

	scheme := "ws"
	if u.Scheme == "https" {
		scheme = "wss"
	}

	return fmt.Sprintf("%s://%s/agent-ws?token=%s", scheme, u.Host, token)
}

// Mengembalikan nilai boolean. True = restart, False = stop agent
func connectAndListen(wsURL string) bool {
	c, _, err := websocket.DefaultDialer.Dial(wsURL, nil)
	if err != nil {
		log.Printf("❌ Failed to connect: %v\n", err)
		return true // Gagal koneksi, minta main loop untuk restart
	}
	defer c.Close()

	fmt.Println("✅ ONLINE & CONNECTED! Waiting for localhost requests...")

	// Tangkap sinyal OS (Ctrl+C / SIGINT) dan Kill (SIGTERM)
	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(interrupt)

	// Channel untuk menangkap error dari koneksi / pembacaan pesan
	connError := make(chan error, 1)

	c.SetReadDeadline(time.Now().Add(pongWait))
	c.SetPongHandler(func(string) error { 
		c.SetReadDeadline(time.Now().Add(pongWait))
		return nil 
	})

	var writeMu sync.Mutex

	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	// Goroutine 1: Ping Heartbeat
	go func() {
		for {
			select {
			case <-ticker.C:
				writeMu.Lock()
				c.SetWriteDeadline(time.Now().Add(10 * time.Second))
				err := c.WriteMessage(websocket.PingMessage, nil)
				writeMu.Unlock()

				if err != nil {
					connError <- fmt.Errorf("ping failed: %v", err)
					return
				}
			}
		}
	}()

	// Goroutine 2: Read Message
	go func() {
		for {
			_, message, err := c.ReadMessage()
			if err != nil {
				connError <- fmt.Errorf("read failed: %v", err)
				return
			}

			var agentMsg AgentMessage
			if err := json.Unmarshal(message, &agentMsg); err != nil {
				continue
			}

			if agentMsg.Type == "REQUEST" {
				//fmt.Printf("⚡ Executing: %s %s\n", agentMsg.Method, agentMsg.URL)
				go handleRequest(c, &writeMu, agentMsg)
			}
		}
	}()

	// ==========================================
	// BLOCKING & MENUNGGU KONDISI (Select)
	// ==========================================
	select {
	case err := <-connError:
		// Jika koneksi terputus/error (misal wifi mati, backend restart)
		log.Printf("\n⚠️ Connection dropped (%v). Triggering restart...\n", err)
		return true // Minta main loop untuk restart

	case sig := <-interrupt:
		// Jika di Ctrl+C atau di kill dari OS
		fmt.Printf("\n🛑 Received signal '%v'. Shutting down agent gracefully...\n", sig)
		
		writeMu.Lock()
		c.SetWriteDeadline(time.Now().Add(3 * time.Second))
		c.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		writeMu.Unlock()
		
		time.Sleep(1 * time.Second) // Tunggu sebentar agar pesan close terkirim
		return false // Minta main loop untuk berhenti total
	}
}

func handleRequest(c *websocket.Conn, writeMu *sync.Mutex, msg AgentMessage) {
	startTime := time.Now()
	
	var bodyReader io.Reader
	contentType := ""

	if msg.BodyType == "json" || msg.BodyType == "text" || msg.BodyType == "xml" {
		bodyReader = bytes.NewBufferString(msg.BodyContent)
	} else if msg.BodyType == "urlencoded" {
		var entries []HeaderItem
		json.Unmarshal([]byte(msg.UrlEncodedEntries), &entries)
		
		formData := url.Values{}
		for _, e := range entries {
			if e.Key != "" { formData.Add(e.Key, e.Value) }
		}
		bodyReader = strings.NewReader(formData.Encode())
		contentType = "application/x-www-form-urlencoded"
	} else if msg.BodyType == "form-data" {
		bodyBuf := &bytes.Buffer{}
		writer := multipart.NewWriter(bodyBuf)
		
		for _, part := range msg.FormDataParts {
			if part.Type == "text" {
				writer.WriteField(part.Key, part.Value)
			} else if part.Type == "file" {
				fileWriter, err := writer.CreateFormFile(part.Key, part.Filename)
				if err == nil {
					decoded, _ := base64.StdEncoding.DecodeString(part.Buffer)
					fileWriter.Write(decoded)
				}
			}
		}
		writer.Close()
		bodyReader = bodyBuf
		contentType = writer.FormDataContentType()
	}

	req, err := http.NewRequest(msg.Method, msg.URL, bodyReader)
	if err != nil {
		sendErrorResponse(c, writeMu, msg.ID, "Invalid Request: "+err.Error(), startTime)
		return
	}

	var headers []HeaderItem
	json.Unmarshal([]byte(msg.HeadersStr), &headers)
	for _, h := range headers {
		if h.Key != "" && strings.ToLower(h.Key) != "host" && strings.ToLower(h.Key) != "content-length" {
			req.Header.Set(h.Key, h.Value)
		}
	}
	if contentType != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", contentType)
	}

	client := &http.Client{Timeout: 25 * time.Second}
	resp, err := client.Do(req)
	
	if err != nil {
		sendErrorResponse(c, writeMu, msg.ID, "Connection Refused / Failed: "+err.Error(), startTime)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	
	var jsonData interface{}
	if err := json.Unmarshal(respBody, &jsonData); err != nil {
		jsonData = string(respBody)
	}

	respHeaders := make(map[string]string)
	for k, v := range resp.Header {
		respHeaders[k] = strings.Join(v, ", ")
	}

	agentResp := AgentResponse{
		Type:       "RESPONSE",
		ID:         msg.ID,
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		Headers:    respHeaders,
		Data:       jsonData,
		Time:       time.Since(startTime).Milliseconds(),
	}

	respJSON, _ := json.Marshal(agentResp)
	
	writeMu.Lock()
	c.WriteMessage(websocket.TextMessage, respJSON)
	writeMu.Unlock()
	
	// Sengaja di-comment log success untuk mengurangi noise saat load test
	// fmt.Printf("✅ Success: %s [%dms]\n", msg.URL, agentResp.Time) 
}

func sendErrorResponse(c *websocket.Conn, writeMu *sync.Mutex, id, errMsg string, start time.Time) {
	fmt.Println("❌ Error:", errMsg)
	agentResp := AgentResponse{
		Type:       "RESPONSE",
		ID:         id,
		Status:     0,
		StatusText: "Error",
		Headers:    map[string]string{},
		Data:       map[string]string{"error": errMsg},
		Time:       time.Since(start).Milliseconds(),
	}
	respJSON, _ := json.Marshal(agentResp)
	
	writeMu.Lock()
	c.WriteMessage(websocket.TextMessage, respJSON)
	writeMu.Unlock()
}

func loadConfig() Config {
	var config Config
	file, err := os.ReadFile(configFileName)
	if err == nil {
		json.Unmarshal(file, &config)
	}
	return config
}

func saveConfig(config Config) {
	data, _ := json.MarshalIndent(config, "", "  ")
	os.WriteFile(configFileName, data, 0644)
}
