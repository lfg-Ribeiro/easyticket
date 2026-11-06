import React from "react";

const PHONE_NUMBER = "5545920025315";
const MESSAGE = "Olá! Preciso de ajuda com a plataforma EasyTicket.";
const WHATSAPP_URL = `https://wa.me/${PHONE_NUMBER}?text=${encodeURIComponent(MESSAGE)}`;

export const FloatingWhatsApp: React.FC = () => {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Suporte via WhatsApp"
      className="group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-black/25 ring-1 ring-black/5 transition-all duration-300 hover:-translate-y-0.5 hover:scale-110 hover:bg-[#1ebe5b] hover:shadow-xl hover:shadow-[#25D366]/40 focus:outline-none focus-visible:ring-4 focus-visible:ring-[#25D366]/50 active:scale-95"
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 rounded-full bg-[#25D366] opacity-30 motion-safe:animate-ping [animation-duration:2.5s] motion-reduce:hidden"
      />

      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="30"
        height="30"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        className="relative transition-transform duration-300 group-hover:-rotate-6"
      >
        <path
          d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <g transform="translate(6.4 6.2) scale(0.5)">
          <path
            d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </g>
      </svg>
    </a>
  );
};