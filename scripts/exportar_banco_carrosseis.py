#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Exporta o Banco de Carrosséis Best-Sellers (Vick Machado) para a Central.

João, 15/10/2026: "era para ter os moldes a mais lá, né, não tem do curso que
compramos". A página de Moldes mostrava só os 10 moldes visuais da casa; o curso
comprado no Hotmart estava parado em ~/Dev/cursos e nunca chegou na tela.

Cada um dos 22 formatos vira um cartão com a intenção (conexão, conversão,
crescimento), a estrutura slide a slide, o detalhamento de como montar cada
slide, o "por que funciona", o template do Canva e os carrosséis reais do
Instagram que o curso usa como exemplo, lâmina por lâmina.

Gera src/data/banco-carrosseis.ts, public/banco/pranchas e public/banco/<formato>.
Rodar de novo quando o curso for atualizado; não editar o .ts à mão.
"""
import json, os, re, shutil, sys, unicodedata
from PIL import Image

CURSO = os.path.expanduser('~/Dev/cursos/Banco de Carrosseis Best-Sellers (Vick Machado)')
CENTRAL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(CENTRAL, 'public', 'banco')
# Mesma medida das lâminas da casa (public/moldes): 4:5, webp, leve o bastante
# para a grade abrir rápido num 4G de consultório.
LARGURA, ALTURA = 540, 675


def slug(texto):
    sem_acento = ''.join(c for c in unicodedata.normalize('NFD', texto) if unicodedata.category(c) != 'Mn')
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', sem_acento.lower())).strip('-')


def sem_enfase(texto):
    """Tira o negrito e o itálico do markdown: a tela mostra texto puro."""
    texto = re.sub(r'\*\*(.+?)\*\*', r'\1', texto, flags=re.S)
    return re.sub(r'(?<!\w)\*(.+?)\*(?!\w)', r'\1', texto, flags=re.S)


def lamina(origem, destino):
    """Recorta no 4:5 da casa. Slide de Instagram já vem 4:5 ou 1:1."""
    im = Image.open(origem).convert('RGB')
    alvo = LARGURA / ALTURA
    atual = im.width / im.height
    if atual > alvo:  # largo demais: corta as laterais, o texto fica no centro
        corte = round(im.height * alvo)
        im = im.crop(((im.width - corte) // 2, 0, (im.width - corte) // 2 + corte, im.height))
    elif atual < alvo:  # alto demais: corta de baixo, o gancho está em cima
        corte = round(im.width / alvo)
        im = im.crop((0, 0, im.width, corte))
    im.resize((LARGURA, ALTURA), Image.LANCZOS).save(destino, 'WEBP', quality=72, method=6)


def prancha(nome):
    """A tira de contato do curso: referência larga, não arte final."""
    origem = os.path.join(CURSO, 'pranchas', nome + '.jpg')
    if not os.path.isfile(origem):
        return ''
    im = Image.open(origem).convert('RGB')
    if im.width > 1400:
        im = im.resize((1400, round(im.height * 1400 / im.width)), Image.LANCZOS)
    arq = 'pranchas/' + slug(nome) + '.webp'
    im.save(os.path.join(OUT, arq), 'WEBP', quality=72, method=6)
    return '/banco/' + arq


def secao(texto, titulo, fim):
    """Pega o corpo de uma seção do markdown do curso, tolerante ao formato.

    O curso mistura cabeçalho ("### **ESTRUTURA DO FORMATO**") com negrito solto
    dentro de um bloco <aside> ("**POR QUE FUNCIONA?**"), então o título pode vir
    com ou sem # na frente.
    """
    marcador = lambda t: r'(?:#+\s*)?\**\s*' + t
    partes = re.split(marcador(titulo), texto, maxsplit=1)
    if len(partes) < 2:
        return ''
    corpo = partes[1]
    for marca in fim:
        corpo = re.split(marcador(marca), corpo, maxsplit=1)[0]
    return corpo


def detalhar(corpo):
    """"**SLIDE 01.** texto" vira {slide, como}. Faixas tipo "SLIDE 02 a N-1" entram inteiras."""
    passos = []
    for bruto in re.split(r'\*\*(SLIDE[^*]*?)\.?\*\*', corpo)[1:]:
        if bruto.strip().upper().startswith('SLIDE'):
            passos.append({'slide': re.sub(r'\s+', ' ', bruto).strip().rstrip('.'), 'como': ''})
        elif passos:
            limpo = re.sub(r'\n{2,}', '\n', re.sub(r'[ \t]+', ' ', bruto)).strip()
            passos[-1]['como'] = sem_enfase(limpo.split('<aside>')[0].strip())
    return [p for p in passos if p['como']]


def exemplos_de(nome, formato_slug, ordem):
    """Casa cada link do Instagram com a pasta de imagens baixada, pelo shortcode."""
    raiz = os.path.join(CURSO, 'exemplos', nome)
    if not os.path.isdir(raiz):
        return []
    pastas = {d for d in os.listdir(raiz) if os.path.isdir(os.path.join(raiz, d))}
    # Primeiro na ordem em que o curso cita; o que sobrar entra no fim, para não perder exemplo.
    codigos = [c for c in ordem if c in pastas] + sorted(pastas - set(ordem))
    saida = []
    for n, codigo in enumerate(codigos, 1):
        arquivos = sorted(
            (a for a in os.listdir(os.path.join(raiz, codigo)) if a.lower().endswith(('.jpg', '.jpeg', '.png'))),
            # O nome é <id do post>_<id do slide>: o id do slide cresce na ordem do carrossel.
            key=lambda a: [int(p) for p in re.findall(r'\d+', a)] or [0],
        )
        if not arquivos:
            continue
        pasta_destino = os.path.join(OUT, formato_slug)
        os.makedirs(pasta_destino, exist_ok=True)
        laminas = []
        for i, arquivo in enumerate(arquivos, 1):
            rel = '%s/%s-%02d.webp' % (formato_slug, codigo, i)
            lamina(os.path.join(raiz, codigo, arquivo), os.path.join(OUT, rel))
            laminas.append('/banco/' + rel)
        saida.append({'id': codigo, 'numero': n, 'url': 'https://www.instagram.com/p/%s/' % codigo, 'laminas': laminas})
    return saida


def ler(nome):
    texto = open(os.path.join(CURSO, 'modelos', nome + '.md'), encoding='utf-8').read()
    bruta = (re.search(r'INTENÇÃO:\s*(.+)', texto) or [None, ''])[1]
    intencoes = [i for i in ('CONEXÃO', 'CONVERSÃO', 'CRESCIMENTO') if i in bruta.upper()]
    canva = list(dict.fromkeys(re.findall(r'https://canva\.link/[\w-]+', texto)))
    codigos = list(dict.fromkeys(re.findall(r'instagram\.com/p/([\w-]+)', texto)))
    estrutura = [re.sub(r'\s+', ' ', l).strip() for l in secao(texto, 'ESTRUTURA DO FORMATO', ['DETALHAMENTO']).splitlines()
                 if re.match(r'^\s*(\d{1,2}|N)\b', l.strip())]
    porque = secao(texto, 'POR QUE FUNCIONA', [])
    porque = porque.replace('</aside>', '').replace('<aside>', '')
    # O "?**" que fecha o título do curso sobra na primeira linha.
    porque = re.sub(r'^\s*\?*\**', '', porque)
    porque = '\n'.join(l.strip() for l in sem_enfase(re.sub(r'[ \t]+', ' ', porque)).splitlines() if l.strip())
    s = slug(nome)
    return {
        'id': s, 'nome': nome, 'intencoes': intencoes, 'canva': canva,
        'estrutura': estrutura,
        'detalhamento': detalhar(secao(texto, 'DETALHAMENTO DO FORMATO', ['POR QUE FUNCIONA'])),
        'porqueFunciona': porque,
        'prancha': prancha(nome),
        'exemplos': exemplos_de(nome, s, codigos),
    }


if not os.path.isdir(CURSO):
    sys.exit('curso não encontrado em ' + CURSO)
if os.path.isdir(OUT):
    shutil.rmtree(OUT)
os.makedirs(os.path.join(OUT, 'pranchas'))

nomes = sorted((f[:-3] for f in os.listdir(os.path.join(CURSO, 'modelos')) if f.endswith('.md')),
               key=lambda n: slug(n))
formatos = [ler(n) for n in nomes]

ts = (
    '// Banco de Carrosséis Best-Sellers (Vick Machado), comprado no Hotmart Club e exportado\n'
    '// do Notion em 04/10/2026. Arquivo GERADO por scripts/exportar_banco_carrosseis.py:\n'
    '// não editar à mão, rodar o exportador de novo. Lâminas e pranchas em public/banco.\n\n'
    'export interface ExemploBanco { id: string; numero: number; url: string; laminas: string[] }\n'
    'export interface PassoBanco { slide: string; como: string }\n'
    'export interface FormatoBanco {\n'
    '  id: string\n  nome: string\n'
    "  /** CONEXÃO, CONVERSÃO ou CRESCIMENTO: para que serve a peça. */\n"
    '  intencoes: string[]\n  canva: string[]\n  estrutura: string[]\n'
    '  detalhamento: PassoBanco[]\n  porqueFunciona: string\n  prancha: string\n  exemplos: ExemploBanco[]\n}\n\n'
    'export const BANCO: FormatoBanco[] = ' + json.dumps(formatos, ensure_ascii=False, indent=2) + '\n'
)
open(os.path.join(CENTRAL, 'src', 'data', 'banco-carrosseis.ts'), 'w', encoding='utf-8').write(ts)

print('formatos: %d' % len(formatos))
for chave in ('intencoes', 'canva', 'estrutura', 'detalhamento', 'porqueFunciona', 'prancha', 'exemplos'):
    print('  com %s: %d/%d' % (chave, sum(1 for f in formatos if f[chave]), len(formatos)))
print('exemplos: %d | lâminas: %d' % (sum(len(f['exemplos']) for f in formatos),
                                      sum(len(e['laminas']) for f in formatos for e in f['exemplos'])))
