package main

import (
	"bufio"
	"bytes"
	"crypto/tls"
	"encoding/base64"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"math/rand"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/elazarl/goproxy"
	"github.com/gorilla/websocket"
)

// ==========================================
// STRUKTUR KONFIGURASI & PAYLOAD
// ==========================================
type Config struct {
	URL   string `json:"url"`
	Token string `json:"token"`
}

type HeaderItem struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

type FormDataPart struct {
	Type     string `json:"type"`
	Key      string `json:"key"`
	Value    string `json:"value"`
	Filename string `json:"filename"`
	Buffer   string `json:"buffer"`
}

type AgentMessage struct {
	Type              string            `json:"type"`
	ID                string            `json:"id"`
	Method            string            `json:"method"`
	URL               string            `json:"url"`
	HeadersStr        string            `json:"headersStr"`
	BodyType          string            `json:"bodyType"`
	BodyContent       string            `json:"bodyContent"`
	UrlEncodedEntries string            `json:"urlencodedEntries"`
	FormDataParts     []FormDataPart    `json:"formDataParts"`
	Action            string            `json:"action"`  
	Payload           string            `json:"payload"` 
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

type WSMessageOut struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type InterceptPayload struct {
	Method     string            `json:"method"`
	URL        string            `json:"url"`
	ReqHeaders map[string]string `json:"reqHeaders"`
	ReqBody    string            `json:"reqBody"`
	Status     int               `json:"status"`
	ResHeaders map[string]string `json:"resHeaders"`
	ResBody    string            `json:"resBody"`
	Time       int64             `json:"time"`
}

// ==========================================
// STATE GLOBAL & MUTEX
// ==========================================
const (
	configFileName = "config.json"
	pongWait       = 30 * time.Second 
	pingPeriod     = 10 * time.Second 
)

var (
	proxyPort string

	// WebSocket Global State
	activeConn *websocket.Conn
	connMu     sync.Mutex

	// State untuk Chaos Engineering
	chaosDelayMs   int  = 0
	chaosErrorRate int  = 0
	chaosOffline   bool = false
	chaosMutex     sync.RWMutex

	// State untuk Logcat
	logcatCmd   *exec.Cmd
	logcatMutex sync.Mutex
)

func safeWriteWS(msgType string, data interface{}) {
	connMu.Lock()
	defer connMu.Unlock()
	
	if activeConn == nil {
		return 
	}
	
	payload := WSMessageOut{
		Type: msgType,
		Data: data,
	}
	respJSON, _ := json.Marshal(payload)
	activeConn.WriteMessage(websocket.TextMessage, respJSON)
}

// ==========================================
// FUNGSI 1: HTTP CLIENT BIAASA
// ==========================================
func handleRequest(msg AgentMessage) {
	startTime := time.Now()
	log.Printf("⚡ Executing Request: %s %s\n", msg.Method, msg.URL)

	var bodyReader io.Reader
	contentType := ""

	if msg.BodyType == "json" || msg.BodyType == "text" || msg.BodyType == "xml" {
		bodyReader = bytes.NewBufferString(msg.BodyContent)
	} else if msg.BodyType == "urlencoded" {
		var entries []HeaderItem
		json.Unmarshal([]byte(msg.UrlEncodedEntries), &entries)

		formData := url.Values{}
		for _, e := range entries {
			if e.Key != "" {
				formData.Add(e.Key, e.Value)
			}
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
	} else {
		bodyReader = nil
	}

	req, err := http.NewRequest(msg.Method, msg.URL, bodyReader)
	if err != nil {
		sendErrorResponse(msg.ID, "Invalid Request: "+err.Error(), startTime)
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

	// Bypass SSL Verification untuk HTTP Requests
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &http.Transport{
			TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
		},
	}
	
	resp, err := client.Do(req)

	if err != nil {
		sendErrorResponse(msg.ID, "Connection Refused / Failed: "+err.Error(), startTime)
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

	safeWriteWS("RESPONSE", agentResp)
	log.Printf("✅ Success: %s [%dms]\n", msg.URL, agentResp.Time)
}

func sendErrorResponse(id, errMsg string, start time.Time) {
	fmt.Println("❌ Request Error:", errMsg)
	agentResp := AgentResponse{
		Type:       "RESPONSE",
		ID:         id,
		Status:     0,
		StatusText: "Error",
		Headers:    map[string]string{},
		Data:       map[string]string{"error": errMsg},
		Time:       time.Since(start).Milliseconds(),
	}
	safeWriteWS("RESPONSE", agentResp)
}

// ===============================================
// FUNGSI 2: ADB DEVICE ACTION (E2E UI TESTING)
// ===============================================
func executeDeviceAction(msg AgentMessage) {
	log.Printf("[ADB] Executing Action: %s | Payload: %s\n", msg.Action, msg.Payload)
	var cmd *exec.Cmd

	switch msg.Action {
	case "tap":
		coords := strings.Split(msg.Payload, " ")
		if len(coords) == 2 { cmd = exec.Command("adb", "shell", "input", "tap", coords[0], coords[1]) }
	case "text":
		cmd = exec.Command("adb", "shell", "input", "text", strings.ReplaceAll(msg.Payload, " ", "%s"))
	case "keycode":
		cmd = exec.Command("adb", "shell", "input", "keyevent", msg.Payload)
	case "swipe":
		args := append([]string{"shell", "input", "swipe"}, strings.Split(msg.Payload, " ")...)
		cmd = exec.Command("adb", args...)
	case "shell":
		args := append([]string{"shell"}, strings.Split(msg.Payload, " ")...)
		cmd = exec.Command("adb", args...)
	}

	if cmd != nil {
		out, err := cmd.CombinedOutput()
		status := "SUCCESS"
		errMsg := ""
		if err != nil {
			status = "FAILED"
			errMsg = err.Error() + ": " + string(out)
			log.Printf("[ADB] FAILED: %s", errMsg)
		} else {
			log.Printf("[ADB] SUCCESS")
		}

		safeWriteWS("DEVICE_ACTION_RESULT", map[string]interface{}{
			"id":     msg.ID,
			"status": status,
			"output": string(out),
			"error":  errMsg,
		})
	}
}

// ===============================================
// FUNGSI 3: ADB LOGCAT STREAMING
// ===============================================
func handleLogcat(msg AgentMessage) {
	logcatMutex.Lock()
	defer logcatMutex.Unlock()

	if msg.Action == "start" {
		if logcatCmd != nil { return } 
		
		log.Println("[LOGCAT] Memulai stream logcat Android...")
		args := []string{"logcat", "-v", "time"}
		if msg.Payload != "" {
			args = append(args, strings.Split(msg.Payload, " ")...)
		}
		
		logcatCmd = exec.Command("adb", args...)
		stdout, err := logcatCmd.StdoutPipe()
		if err != nil {
			log.Println("[LOGCAT] Error pipe:", err)
			return
		}

		if err := logcatCmd.Start(); err != nil {
			log.Println("[LOGCAT] Error start:", err)
			return
		}

		go func() {
			scanner := bufio.NewScanner(stdout)
			for scanner.Scan() {
				line := scanner.Text()
				safeWriteWS("LOGCAT_TRAFFIC", map[string]interface{}{ "line": line })
			}
			log.Println("[LOGCAT] Stream berhenti.")
		}()

	} else if msg.Action == "stop" {
		if logcatCmd != nil {
			log.Println("[LOGCAT] Menghentikan stream logcat Android...")
			logcatCmd.Process.Kill()
			logcatCmd = nil
		}
	}
}

// ===============================================
// FUNGSI 4: SETTING CHAOS CONFIG
// ===============================================
func updateChaosConfig(payload string) {
	var config map[string]interface{}
	if err := json.Unmarshal([]byte(payload), &config); err == nil {
		chaosMutex.Lock()
		if val, ok := config["delayMs"].(float64); ok { chaosDelayMs = int(val) }
		if val, ok := config["errorRate"].(float64); ok { chaosErrorRate = int(val) }
		if val, ok := config["offline"].(bool); ok { chaosOffline = val }
		chaosMutex.Unlock()
		log.Printf("[CHAOS] Config diperbarui: Delay=%dms, ErrorRate=%d%%, Offline=%v\n", chaosDelayMs, chaosErrorRate, chaosOffline)
	}
}

// ===============================================
// FUNGSI 5: MITM PROXY SERVER UNTUK ANDROID
// ===============================================
func startMITMProxy() {
	proxy := goproxy.NewProxyHttpServer()
	proxy.Verbose = false 
	proxy.OnRequest().HandleConnect(goproxy.AlwaysMitm)

	proxy.OnRequest().DoFunc(func(req *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
		chaosMutex.RLock()
		offline := chaosOffline
		delay := chaosDelayMs
		errRate := chaosErrorRate
		chaosMutex.RUnlock()

		if offline {
			log.Println("[CHAOS] Memblokir request (Offline Mode)")
			return req, goproxy.NewResponse(req, goproxy.ContentTypeText, http.StatusServiceUnavailable, "Resty Flow Chaos Engine: Network Offline Simulation")
		}
		if delay > 0 {
			log.Printf("[CHAOS] Menunda request %d ms\n", delay)
			time.Sleep(time.Duration(delay) * time.Millisecond)
		}
		if errRate > 0 && rand.Intn(100) < errRate {
			log.Println("[CHAOS] Menyuntikkan HTTP 502 Bad Gateway secara acak")
			return req, goproxy.NewResponse(req, goproxy.ContentTypeText, http.StatusBadGateway, "Resty Flow Chaos Engine: Random Error Injected")
		}

		if req.Body != nil {
			bodyBytes, err := ioutil.ReadAll(req.Body)
			if err == nil {
				req.Body = ioutil.NopCloser(bytes.NewBuffer(bodyBytes))
				ctx.UserData = bodyBytes
			}
		}
		
		ctx.UserData = map[string]interface{}{
			"startTime": time.Now(),
			"reqBody":   ctx.UserData, 
		}
		return req, nil
	})

	proxy.OnResponse().DoFunc(func(resp *http.Response, ctx *goproxy.ProxyCtx) *http.Response {
		if resp == nil || resp.Request == nil { return resp }

		urlStr := resp.Request.URL.String()
		if strings.Contains(urlStr, "google.com/generate_204") || strings.Contains(urlStr, "connectivitycheck") {
			return resp
		}

		var duration int64 = 0
		var reqBodyStr string

		if userData, ok := ctx.UserData.(map[string]interface{}); ok {
			if startTime, ok := userData["startTime"].(time.Time); ok { duration = time.Since(startTime).Milliseconds() }
			if reqBytes, ok := userData["reqBody"].([]byte); ok { reqBodyStr = string(reqBytes) }
		}

		var resBodyStr string
		if resp.Body != nil {
			resBytes, err := ioutil.ReadAll(resp.Body)
			if err == nil {
				resBodyStr = string(resBytes)
				resp.Body = ioutil.NopCloser(bytes.NewBuffer(resBytes))
			}
		}

		reqHeaders := make(map[string]string)
		for k, v := range resp.Request.Header { reqHeaders[k] = strings.Join(v, ", ") }
		resHeaders := make(map[string]string)
		for k, v := range resp.Header { resHeaders[k] = strings.Join(v, ", ") }

		interceptData := InterceptPayload{
			Method: resp.Request.Method, URL: urlStr, ReqHeaders: reqHeaders, ReqBody: reqBodyStr,
			Status: resp.StatusCode, ResHeaders: resHeaders, ResBody: resBodyStr, Time: duration,
		}

		safeWriteWS("INTERCEPT_TRAFFIC", interceptData)
		log.Printf("[MITM] Intercepted: %s %s [%d]", resp.Request.Method, urlStr, resp.StatusCode)
		return resp
	})

	log.Printf("🚀 Local MITM Proxy Server berjalan di port %s\n", proxyPort)
	log.Printf("👉 Arahkan WiFi Android Anda ke Proxy IP_KOMPUTER_ANDA:%s\n", proxyPort)
	log.Printf("🔒 Download Root CA Certificate di http://127.0.0.1:%s/cert\n", proxyPort)

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Jika user mengakses /cert, berikan file sertifikatnya
		if r.Method == http.MethodGet && r.URL.Path == "/cert" {
			w.Header().Set("Content-Type", "application/x-x509-ca-cert")
			w.Header().Set("Content-Disposition", `attachment; filename="resty-flow-ca.crt"`)
			w.Write(goproxy.CA_CERT)
			return
		}
		// Untuk semua trafik lainnya (termasuk CONNECT HTTPS), teruskan ke goproxy
		proxy.ServeHTTP(w, r)
	})

	go func() {
		// Jalankan server menggunakan custom handler
		if err := http.ListenAndServe(":"+proxyPort, handler); err != nil {
			log.Fatal("Gagal menjalankan proxy:", err)
		}
	}()
}

// ==========================================
// BOOTSTRAP & MAIN LOOP
// ==========================================
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

func connectAndListen(wsURL string) bool {
	// ==========================================
	// PERBAIKAN: Bypass SSL/TLS Validation untuk WebSocket Dialer
	// ==========================================
	dialer := *websocket.DefaultDialer
	dialer.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}

	c, _, err := dialer.Dial(wsURL, nil)
	if err != nil {
		log.Printf("❌ Failed to connect: %v\n", err)
		return true // Minta main loop untuk retry
	}
	
	connMu.Lock()
	activeConn = c
	connMu.Unlock()

	defer func() {
		connMu.Lock()
		activeConn = nil
		connMu.Unlock()
		c.Close()
	}()

	fmt.Println("✅ ONLINE & CONNECTED! Waiting for requests...")

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)
	defer signal.Stop(interrupt)

	connError := make(chan error, 1)

	c.SetReadDeadline(time.Now().Add(pongWait))
	c.SetPongHandler(func(string) error {
		c.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	ticker := time.NewTicker(pingPeriod)
	defer ticker.Stop()

	go func() {
		for {
			select {
			case <-ticker.C:
				connMu.Lock()
				if activeConn != nil {
					activeConn.SetWriteDeadline(time.Now().Add(5 * time.Second))
					err := activeConn.WriteMessage(websocket.PingMessage, nil)
					if err != nil {
						connMu.Unlock()
						connError <- fmt.Errorf("ping failed: %v", err)
						return
					}
				}
				connMu.Unlock()
			}
		}
	}()

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
				go handleRequest(agentMsg)
			} else if agentMsg.Type == "DEVICE_ACTION" {
				go executeDeviceAction(agentMsg)
			} else if agentMsg.Type == "LOGCAT" {
				go handleLogcat(agentMsg)
			} else if agentMsg.Type == "CHAOS_CONFIG" {
				updateChaosConfig(agentMsg.BodyContent)
			}
		}
	}()

	select {
	case err := <-connError:
		log.Printf("\n⚠️ Connection dropped (%v). Triggering restart...\n", err)
		return true

	case sig := <-interrupt:
		fmt.Printf("\n🛑 Received signal '%v'. Shutting down agent gracefully...\n", sig)
		
		connMu.Lock()
		if activeConn != nil {
			activeConn.SetWriteDeadline(time.Now().Add(3 * time.Second))
			activeConn.WriteMessage(websocket.CloseMessage, websocket.FormatCloseMessage(websocket.CloseNormalClosure, ""))
		}
		connMu.Unlock()

		time.Sleep(1 * time.Second)
		return false
	}
}

func main() {
	fmt.Println("========================================")
	fmt.Println("🚀 Rest Flow Local Agent Tunnel + Proxy")
	fmt.Println("========================================")

	rand.Seed(time.Now().UnixNano())

	urlFlag := flag.String("url", "", "Rest Flow Backend URL (e.g. https://domain.com)")
	tokenFlag := flag.String("token", "", "Your Secret Tunnel Token")
	portFlag := flag.String("proxy", "8081", "Port untuk MITM Android Proxy")
	flag.Parse()

	proxyPort = *portFlag
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

	startMITMProxy()

	wsURL := formatWebSocketURL(config.URL, config.Token)

	for {
		fmt.Printf("🔄 Connecting to %s...\n", config.URL)
		shouldRestart := connectAndListen(wsURL)

		if !shouldRestart {
			break 
		}

		fmt.Println("⏳ Retrying connection in 5 seconds...")
		time.Sleep(5 * time.Second)
	}

	fmt.Println("👋 Agent exited successfully.")
}
