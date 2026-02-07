# TAREAS JARVIS APP - 2026-02-08
# T5: Real-time talk | T6: RAG mejorado | T7: App Mac + TestFlight

---

## T5 — FIX REAL-TIME TALK (45 min)

### Diagnóstico

**Verificar componentes:**

1. **WebSocket/Realtime habilitado?**
```sql
-- En Supabase Dashboard → Database → Replication
-- Verificar que la tabla messages/chat tiene Realtime habilitado
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE tablename IN ('messages', 'chat', 'tasks');
-- Si no devuelve filas → Realtime NO está habilitado
```

2. **RLS Policies permiten Realtime?**
```sql
-- Verificar policies en tabla messages
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename = 'messages';
-- Debe haber policy que permita SELECT para authenticated/anon
```

3. **Frontend subscrito correctamente?**
```bash
# Revisar código en jarvis2026-app
cd ~/clawd/jarvis2026-app
grep -r "supabase.channel\|realtime" src/ | head -10
```

### Fix Común: Habilitar Realtime

**Si Realtime NO está habilitado:**

1. Dashboard → Database → Replication
2. Seleccionar tabla (messages/chat)
3. Toggle "Enable Realtime" → ON
4. Click "Save"

**Test:**
```javascript
// En browser console
const { data, error } = await supabase
  .channel('test-channel')
  .on('postgres_changes', { 
    event: 'INSERT', 
    schema: 'public', 
    table: 'messages' 
  }, (payload) => {
    console.log('✅ Realtime funciona:', payload);
  })
  .subscribe();
```

---

## T6 — MEJORAR RAG (60 min)

### Estado Actual

**Verificar tablas RAG:**
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND (table_name LIKE '%rag%' OR table_name LIKE '%knowledge%' OR table_name LIKE '%embedding%');
```

### Mejoras Propuestas

#### 1. Añadir Embeddings (OpenAI)

```sql
-- Crear tabla de embeddings
CREATE TABLE IF NOT EXISTS knowledge_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI ada-002 dimension
  source TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para similarity search
CREATE INDEX ON knowledge_embeddings 
USING ivfflat (embedding vector_cosine_ops);
```

**Poblar con datos:**
```javascript
// Script para generar embeddings
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function embedKnowledge(texts) {
  for (const text of texts) {
    // Generate embedding
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text.content
    });
    
    const embedding = response.data[0].embedding;
    
    // Store
    await supabase.from('knowledge_embeddings').insert({
      content: text.content,
      embedding,
      source: text.source
    });
  }
}
```

#### 2. Similarity Search

```sql
-- Función para buscar conocimiento similar
CREATE OR REPLACE FUNCTION search_knowledge(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.8,
  match_count int DEFAULT 5
)
RETURNS TABLE (
  content text,
  similarity float
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    knowledge_embeddings.content,
    1 - (knowledge_embeddings.embedding <=> query_embedding) as similarity
  FROM knowledge_embeddings
  WHERE 1 - (knowledge_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;
```

#### 3. Auto-Update Triggers

```sql
-- Trigger cuando llega email nuevo
CREATE OR REPLACE FUNCTION update_rag_on_email()
RETURNS TRIGGER AS $$
BEGIN
  -- Extraer info relevante del email
  INSERT INTO knowledge_embeddings (content, source)
  VALUES (
    NEW.subject || E'\n' || NEW.body,
    'email:' || NEW.id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER email_to_rag
AFTER INSERT ON emails
FOR EACH ROW
EXECUTE FUNCTION update_rag_on_email();
```

#### 4. Proactividad

**Edge Function para sugerencias:**
```javascript
// suggest-actions.ts
export async function suggestActions(context) {
  // Get user's schedule, emails, tasks
  const today = await supabase.from('tasks')
    .select('*')
    .eq('due_date', 'today')
    .eq('status', 'pending');
  
  const emails = await supabase.from('emails')
    .select('*')
    .eq('read', false)
    .order('received_at', { ascending: false })
    .limit(10);
  
  // Search RAG for relevant context
  const ragContext = await searchRAG(context.currentActivity);
  
  // Generate suggestions with AI
  const suggestions = await ai.generate({
    prompt: `Given:
    - Pending tasks: ${JSON.stringify(today.data)}
    - Unread emails: ${emails.data.length}
    - Context: ${ragContext}
    
    Suggest 3 proactive actions for the user.`
  });
  
  return suggestions;
}
```

---

## T7 — APP MAC + TESTFLIGHT (90 min)

### Setup Xcode Project

**Si NO existe proyecto:**
```bash
cd ~/clawd
mkdir -p jarvis-ios
cd jarvis-ios

# Crear proyecto Swift UI
# Xcode → File → New → Project → iOS → App
# Product Name: JarvisApp
# Organization: com.jarvis
# Interface: SwiftUI
# Language: Swift
```

**Si existe:**
```bash
cd ~/clawd/jarvis-ios
open JarvisApp.xcworkspace  # o .xcodeproj
```

### Configuración

**1. Bundle ID & Signing**
```swift
// En Xcode → Target → Signing & Capabilities
// Bundle Identifier: com.jarvis.ios
// Team: KLXF6GTQ85 (de NUCLEAR_MEMORY.md)
// Signing: Automatic
```

**2. Push Notifications**
```swift
// Xcode → Target → Signing & Capabilities
// Click "+" → Push Notifications
// Click "+" → Background Modes → Remote notifications
```

**3. Código Push Notifications**
```swift
// AppDelegate.swift
import UserNotifications
import UIKit

class AppDelegate: NSObject, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Request authorization
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                if granted {
                    DispatchQueue.main.async {
                        application.registerForRemoteNotifications()
                    }
                }
            }
        return true
    }
    
    func application(
        _ application: UIApplication,
        didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
    ) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
        print("📱 APNs Token: \(token)")
        
        // TODO: Enviar token a backend
        sendTokenToBackend(token)
    }
    
    func sendTokenToBackend(_ token: String) {
        // POST to Supabase/Railway
        guard let url = URL(string: "https://jarvis2026-production.up.railway.app/api/devices") else { return }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONEncoder().encode(["token": token, "platform": "ios"])
        
        URLSession.shared.dataTask(with: request).resume()
    }
}
```

**4. Main App**
```swift
// JarvisApp.swift
import SwiftUI

@main
struct JarvisApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) var appDelegate
    
    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

### Build & Upload

**1. Archive**
```bash
# Desde terminal
cd ~/clawd/jarvis-ios

xcodebuild archive \
  -workspace JarvisApp.xcworkspace \
  -scheme JarvisApp \
  -configuration Release \
  -archivePath build/JarvisApp.xcarchive \
  -destination 'generic/platform=iOS'
```

**2. Export IPA**
```bash
# Crear exportOptions.plist
cat > exportOptions.plist << 'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>KLXF6GTQ85</string>
    <key>uploadSymbols</key>
    <true/>
    <key>uploadBitcode</key>
    <false/>
</dict>
</plist>
PLIST

# Export
xcodebuild -exportArchive \
  -archivePath build/JarvisApp.xcarchive \
  -exportPath build/ \
  -exportOptionsPlist exportOptions.plist
```

**3. Upload a TestFlight**
```bash
# Necesitas app-specific password de Apple ID
# Generar en: https://appleid.apple.com → Security → App-Specific Passwords

xcrun altool --upload-app \
  -f build/JarvisApp.ipa \
  -t ios \
  -u tu@email.com \
  -p "app-specific-password"
```

**4. Verificar en App Store Connect**
- Ir a: https://appstoreconnect.apple.com
- My Apps → JarvisApp
- TestFlight tab
- Build debe aparecer en "Processing" → "Ready to Test"

---

## VERIFICACIÓN

**T5 - Real-time:**
```
- [ ] Realtime habilitado en tabla messages
- [ ] RLS policies permiten SELECT
- [ ] Frontend subscrito correctamente
- [ ] Test: Mensaje enviado → aparece en tiempo real
```

**T6 - RAG:**
```
- [ ] Tabla knowledge_embeddings creada
- [ ] Función search_knowledge creada
- [ ] Triggers auto-update configurados
- [ ] Edge Function suggest-actions deployada
- [ ] Test: Query RAG devuelve resultados relevantes
```

**T7 - App Mac:**
```
- [ ] Xcode project configurado
- [ ] Push notifications habilitadas
- [ ] APNs token capturado
- [ ] Build exitoso
- [ ] IPA exportado
- [ ] Upload a TestFlight exitoso
- [ ] Build aparece en App Store Connect
```

---

**Tiempo total estimado:** 195 min (~3 horas)  
**Prioridad:** Media (después de LC Studio + keys)
