# MGR-CONECT 2 - ERP

**Sistema Integrado de Gestão (RH e Projetos)**

O **MGR-CONECT 2** é uma plataforma Fullstack moderna desenvolvida para gestão empresarial, focada em controle de ponto com biometria facial (Gemini AI), gestão de ordens de serviço, controle de estoque e administração de RH.

---

## 🚀 1. Configurações de Produção (Cloud Run)

O sistema está hospedado no Google Cloud Run, utilizando uma arquitetura *stateless* e *serverless*.

### Dados do Deploy
*   **Projeto GCP:** `mgr-conect2`
*   **Região:** `us-west1`
*   **URL de Produção:** [https://mgr-conect-2-615090802090.us-west1.run.app](https://mgr-conect-2-615090802090.us-west1.run.app)

### Variáveis de Ambiente
Para garantir a invalidação de cache em novos deploys, certifique-se de que a seguinte variável está definida:
*   `CACHE_BUST` = `2`

### Fluxo de Atualização
Após realizar alterações no código via AI Studio ou Git:
1.  Faça o build/deploy da nova imagem.
2.  Acesse o Console do Google Cloud: [Cloud Run](https://console.cloud.google.com/run).
3.  Selecione o serviço `mgr-conect-2`.
4.  Clique em **"Edit & Deploy New Revision"**.
5.  Certifique-se de que a variável `CACHE_BUST` está atualizada (opcional, para forçar refresh) e clique em **Deploy**.

---

## 🔧 2. Configuração de CORS (Firebase Storage)

Para que o frontend no Cloud Run consiga fazer upload e download de imagens (fotos de perfil, evidências de ponto) no Firebase Storage, é **obrigatório** configurar o CORS.

**Execute os comandos abaixo no [Google Cloud Shell](https://shell.cloud.google.com):**

```bash
# 1. Selecionar o projeto correto
gcloud config set project mgr-conect2

# 2. Criar arquivo de configuração CORS
cat > cors.json << 'EOF'
[
  {
    "origin": ["https://mgr-conect-2-615090802090.us-west1.run.app", "http://localhost:5173"],
    "method": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization"],
    "maxAgeSeconds": 3600
  }
]
EOF

# 3. Aplicar a configuração ao Bucket
gsutil cors set cors.json gs://mgr-conect2.firebasestorage.app
```

---

## 🛡️ 3. Regras de Segurança (Firebase Storage)

Acesse o [Firebase Console](https://console.firebase.google.com/) → **Storage** → **Rules** e publique as seguintes regras para permitir o funcionamento correto do app:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Regras específicas para fotos de perfil
    match /profiles/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
    // Regra geral para o restante do sistema (Evidências de ponto, anexos de OS)
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 🗄️ 4. Índices do Firestore

O sistema realiza consultas complexas (filtros compostos e ordenação). O Firestore exigirá a criação de índices manuais.

**Índice Principal Necessário:**
*   **Coleção:** `time_entries`
*   **Campos:**
    *   `userId` (Ascendente)
    *   `timestamp` (Descendente)

**Como criar:**
1.  Navegue pelo app até a tela de "Histórico" ou "Relatórios".
2.  Abra o Console do Desenvolvedor no navegador (F12).
3.  Você verá um erro do Firebase contendo um **link direto**.
4.  Clique no link para criar o índice automaticamente no Console do Firebase.

---

## 💻 5. Desenvolvimento Local

Instruções para rodar o projeto em sua máquina local.

### Pré-requisitos
*   Node.js (v18+)
*   NPM ou Yarn

### Instalação

```bash
# Clone o repositório (ou baixe os arquivos)
git clone <url-do-repositorio>

# Entre na pasta
cd mgr-conect-2

# Instale as dependências
npm install
```

### Rodando o Projeto

```bash
# Inicia o servidor de desenvolvimento (Vite)
npm run dev
```
O app estará disponível em `http://localhost:5173`.

### Build para Produção

```bash
# Gera os arquivos estáticos na pasta /dist
npm run build

# Para testar o build localmente
npm run preview
```

---

## 🛠️ Stack Tecnológico

*   **Frontend:** React 18, TypeScript, Vite.
*   **UI/Styling:** Tailwind CSS, Lucide React.
*   **Backend/BaaS:** Firebase (Auth, Firestore, Storage).
*   **AI/ML:** Google Gemini API (Biometria Facial e Análise).
*   **Deploy:** Google Cloud Run (Container Dockerizado/Estático).

---
**MGR Refrigeração** - Todos os direitos reservados.
