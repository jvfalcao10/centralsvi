import React from 'react';
import { ImageResponse } from '@vercel/og';

// Imagem de preview (OG) gerada na hora — vira o card do WhatsApp.
// Recebe client, period e bullets (separados por |) via query, monta arte preto+dourado.
export const config = { runtime: 'edge' };

const h = React.createElement;

export default function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const client = (searchParams.get('client') || 'Cliente').slice(0, 60);
  const period = (searchParams.get('period') || '').slice(0, 60);
  const bullets = (searchParams.get('b') || '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 3);

  return new ImageResponse(
    h(
      'div',
      {
        style: {
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: '#0A0608',
          backgroundImage:
            'radial-gradient(900px 520px at 12% -5%, rgba(232,154,28,0.25), transparent 55%), radial-gradient(820px 540px at 95% 30%, rgba(212,168,44,0.16), transparent 55%)',
          color: '#F7F2E7',
          fontFamily: 'sans-serif',
        },
      },
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column' } },
        h('div', { style: { display: 'flex', fontSize: 24, letterSpacing: 4, color: '#F0C744', fontWeight: 700 } }, 'RELATORIO QUINZENAL · GOOGLE'),
        h('div', { style: { display: 'flex', fontSize: 74, fontWeight: 700, marginTop: 20, lineHeight: 1.04 } }, client),
        period ? h('div', { style: { display: 'flex', fontSize: 30, color: '#A89B82', marginTop: 12 } }, period) : h('div', { style: { display: 'flex' } }),
      ),
      h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: '18px' } },
        ...bullets.map((b, i) =>
          h(
            'div',
            { key: i, style: { display: 'flex', alignItems: 'center', fontSize: 36, fontWeight: 600, color: '#F7F2E7' } },
            h('div', { style: { display: 'flex', width: '14px', height: '14px', borderRadius: '8px', backgroundColor: '#F0C744', marginRight: '20px' } }),
            b,
          ),
        ),
      ),
      h(
        'div',
        { style: { display: 'flex', alignItems: 'center', fontSize: 26, color: '#A89B82' } },
        h('span', { style: { color: '#F0C744', fontWeight: 700 } }, 'SVI'),
        h('span', { style: { marginLeft: '7px', fontWeight: 700, color: '#F7F2E7' } }, 'Company'),
        h('span', { style: { marginLeft: '14px' } }, '· Sistema de Vendas Inteligente'),
      ),
    ),
    { width: 1200, height: 630 },
  );
}
