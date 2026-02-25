# EasyTicket 🎟️

O **EasyTicket** é uma plataforma moderna e segura para venda, gestão e validação de ingressos digitais. Nascido da necessidade de modernizar a experiência de eventos no Brasil, o projeto foca em combater fraudes e facilitar a vida tanto do organizador quanto do comprador final.

## 🎯 O Propósito (Por que o EasyTicket existe?)

O mercado de eventos sofre com dois grandes problemas: a falsificação de ingressos (prints de QR Codes) e a dificuldade no repasse seguro de titularidade quando alguém desiste de ir. 

O EasyTicket foi arquitetado para resolver isso através de:
* **Identidade Real:** Uso do **CPF** como chave primária de segurança para todas as contas e ingressos.
* **Repasse Antifraude:** Um usuário só consegue transferir um ingresso para outro CPF que já esteja validado na plataforma, transferindo a propriedade de forma oficial no banco de dados e invalidando o ingresso anterior.
* **Check-in Dinâmico:** QR Codes gerados a partir de hashes criptográficos únicos que se comunicam em tempo real com o banco de dados durante a validação na portaria.

## ✨ Principais Funcionalidades

* **Para o Comprador:**
  * Compra fluida e rápida via Pix ou Cartão de Crédito.
  * Carteira digital ("Meus Ingressos") com acesso offline/online aos QR Codes.
  * Sistema de transferência de titularidade de ingressos (P2P) integrado.

* **Para o Organizador:**
  * Painel de controle (Dashboard) com métricas financeiras em tempo real.
  * Gráficos de performance de vendas (por hora e por dia).
  * Aplicativo web de escaneamento de QR Code nativo, com bloqueio automático de ingressos duplicados.

## 🛠️ Stack de Tecnologias

O projeto foi construído priorizando performance, escalabilidade e segurança de dados, utilizando as melhores ferramentas do ecossistema atual:

**Frontend (Interface e Experiência):**
* **[React](https://reactjs.org/) + [TypeScript](https://www.typescriptlang.org/):** Para uma interface reativa e código tipado à prova de falhas.
* **[Vite](https://vitejs.dev/):** Ferramenta de build super rápida.
* **[Tailwind CSS](https://tailwindcss.com/) & [shadcn-ui](https://ui.shadcn.com/):** Para um design limpo, moderno e responsivo em qualquer dispositivo (mobile-first).

**Backend (Motor e Segurança):**
* **[Supabase](https://supabase.com/):** Todo o coração do sistema roda aqui.
  * **PostgreSQL:** Banco de dados relacional robusto.
  * **Row Level Security (RLS):** Políticas de segurança estritas onde cada usuário só acessa o que é seu.
  * **Edge Functions & RPCs:** Lógicas complexas (como validação e transferência) rodando direto no servidor para evitar manipulações no lado do cliente.
* **[Vercel](https://vercel.com/):** Hospedagem em nuvem de alta disponibilidade.

---
*Status: Em desenvolvimento fechado para lançamento comercial futuro.*