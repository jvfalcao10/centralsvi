# -*- coding: utf-8 -*-
"""
Restaura os acentos nos textos dos relatorios de Google Meu Negocio ja salvos.

Por que existe: ate 01/09/2026 o prompt que gerava os relatorios estava escrito
sem acento e o modelo devolvia no mesmo registro ("interacoes", "publico").
O prompt foi corrigido (commit 85543dd), mas o texto dos relatorios antigos
ficou gravado no banco. Este script conserta SO a ortografia: nenhum numero,
slug, URL ou estrutura muda.

Uso:  python3 scripts/acentuar_relatorios_gmn.py          (dry-run, nao grava)
      python3 scripts/acentuar_relatorios_gmn.py --aplicar (grava no banco)

A chave service_role e lida do arquivo de memoria do Claude (ja autorizada la).
Backup: o script salva o estado original em backup_relatorios_<data>.json no
mesmo diretorio ANTES de gravar qualquer coisa.
"""
import json, re, sys, base64, urllib.request, datetime, pathlib

REF = 'qvkfcvcqlfamyzgqgnrq'
MEMORIA = pathlib.Path.home() / '.claude/projects/-Users-joao-Documents-CLAUDE-CODE-N8N/memory/reference_svi_tokens.md'

MAPA = {
 'interacao':'interação','interacoes':'interações','visualizacao':'visualização','visualizacoes':'visualizações',
 'avaliacao':'avaliação','avaliacoes':'avaliações','acao':'ação','acoes':'ações','ligacao':'ligação','ligacoes':'ligações',
 'conversao':'conversão','conversoes':'conversões','posicao':'posição','posicoes':'posições','otimizacao':'otimização',
 'informacao':'informação','informacoes':'informações','descricao':'descrição','atencao':'atenção','intencao':'intenção',
 'intencoes':'intenções','promocao':'promoção','promocoes':'promoções','divulgacao':'divulgação','recomendacao':'recomendação',
 'recomendacoes':'recomendações','regiao':'região','direcao':'direção','opcao':'opção','opcoes':'opções','edicao':'edição',
 'producao':'produção','publicacao':'publicação','publicacoes':'publicações','operacao':'operação','variacao':'variação',
 'comparacao':'comparação','reputacao':'reputação','pontuacao':'pontuação','classificacao':'classificação',
 'localizacao':'localização','navegacao':'navegação','indicacao':'indicação','indicacoes':'indicações',
 'nao':'não','sao':'são','entao':'então','estao':'estão','botao':'botão','padrao':'padrão','versao':'versão',
 'numero':'número','numeros':'números','periodo':'período','publico':'público','media':'média','medias':'médias',
 'mes':'mês','tres':'três','ate':'até','tambem':'também','alem':'além','apos':'após','ja':'já','so':'só','ha':'há',
 'voce':'você','voces':'vocês','sera':'será','estara':'estará','ultimo':'último','ultima':'última','ultimos':'últimos',
 'ultimas':'últimas','proximo':'próximo','proxima':'próxima','proximos':'próximos','proximas':'próximas',
 'possivel':'possível','possiveis':'possíveis','disponivel':'disponível','disponiveis':'disponíveis','visivel':'visível',
 'visiveis':'visíveis','incrivel':'incrível','facil':'fácil','dificil':'difícil','util':'útil','uteis':'úteis',
 'unico':'único','unica':'única','unicos':'únicos','unicas':'únicas','varios':'vários','varias':'várias',
 'proprio':'próprio','propria':'própria','minimo':'mínimo','maximo':'máximo','basico':'básico','basica':'básica',
 'especifico':'específico','especifica':'específica','especificos':'específicos','especificas':'específicas',
 'estrategia':'estratégia','estrategias':'estratégias','estrategico':'estratégico','estrategica':'estratégica',
 'historico':'histórico','historica':'histórica','organico':'orgânico','organica':'orgânica','grafico':'gráfico',
 'graficos':'gráficos','rapido':'rápido','rapida':'rápida','rapidos':'rápidos','rapidas':'rápidas','otimo':'ótimo','otima':'ótima',
 'frequencia':'frequência','experiencia':'experiência','audiencia':'audiência','tendencia':'tendência','tendencias':'tendências',
 'presenca':'presença','diferenca':'diferença','confianca':'confiança','mudanca':'mudança','mudancas':'mudanças',
 'relevancia':'relevância','importancia':'importância','distancia':'distância','sequencia':'sequência',
 'agencia':'agência','negocio':'negócio','negocios':'negócios','servico':'serviço','servicos':'serviços',
 'preco':'preço','precos':'preços','espaco':'espaço','endereco':'endereço','comeco':'começo','comecar':'começar',
 'comecou':'começou','comecando':'começando','reforca':'reforça','reforcar':'reforçar','alcancar':'alcançar',
 'relatorio':'relatório','relatorios':'relatórios','horario':'horário','horarios':'horários','comentario':'comentário',
 'comentarios':'comentários','usuario':'usuário','usuarios':'usuários','calendario':'calendário','anuncio':'anúncio',
 'anuncios':'anúncios','beneficio':'benefício','beneficios':'benefícios','criterio':'critério','municipio':'município',
 'saude':'saúde','clinica':'clínica','clinicas':'clínicas','medico':'médico','medicos':'médicos','medica':'médica',
 'consultorio':'consultório','conteudo':'conteúdo','conteudos':'conteúdos',
 'nivel':'nível','niveis':'níveis','favoravel':'favorável','saudavel':'saudável','notavel':'notável','estavel':'estável',
 'consistencia':'consistência','eficiencia':'eficiência',
 'forca':'força','forcas':'forças','maxima':'máxima','colegio':'colégio','tecnico':'técnico',
 'tecnica':'técnica','tecnicos':'técnicos','maos':'mãos','relacao':'relação','relacoes':'relações',
 'situacao':'situação','solucao':'solução','solucoes':'soluções','funcao':'função','funcoes':'funções',
 'manutencao':'manutenção','evolucao':'evolução','exposicao':'exposição','impressao':'impressão',
 'impressoes':'impressões','visao':'visão','orcamento':'orçamento','trafego':'tráfego','pagina':'página',
 'paginas':'páginas','video':'vídeo','videos':'vídeos','porem':'porém','atraves':'através','sabado':'sábado',
 'terca':'terça','necessario':'necessário','necessaria':'necessária','jordao':'jordão','veiculo':'veículo',
 'veiculos':'veículos','duvida':'dúvida','duvidas':'dúvidas','pratico':'prático','pratica':'prática',
 'telefonica':'telefônica','eletronico':'eletrônico','instalacao':'instalação',
 'satisfacao':'satisfação','percepcao':'percepção','captacao':'captação','fidelizacao':'fidelização',
}
# unit aparece na tela ('555 visualizacoes'), entao tambem precisa de acento
PULAR = {'image_url', 'slug', 'key'}
# "esta" vira "está" so quando o que vem depois prova que e verbo
RE_ESTA = re.compile(r'\b([Ee]sta)(\s+(?:em|com|bem|no|na|entre|acima|abaixo|funcionando|crescendo|caindo|subindo|melhorando|forte|claro|clara|correto|correta|visivel|visível|ativo|ativa|estavel|estável|otimizado|otimizada|posicionado|posicionada|presente|disponivel|disponível|pouco|pronto|pronta|atendendo)\b)')
# "E um sinal" no comeco de frase e sempre "É um sinal"
RE_EUM = re.compile(r'(^|[.!?]\s+)E(\s+um\s+sinal\b)')


def achar_chave():
    txt = MEMORIA.read_text()
    for t in re.findall(r'eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}', txt):
        b = t.split('.')[1]; b += '=' * (-len(b) % 4)
        try:
            d = json.loads(base64.urlsafe_b64decode(b))
        except Exception:
            continue
        if d.get('ref') == REF and d.get('role') == 'service_role':
            return t
    sys.exit('chave service_role do projeto da Central nao achada na memoria')


def api(chave, metodo, caminho, corpo=None):
    req = urllib.request.Request(
        f'https://{REF}.supabase.co/rest/v1/{caminho}',
        data=json.dumps(corpo).encode() if corpo is not None else None,
        method=metodo,
        headers={'apikey': chave, 'Authorization': f'Bearer {chave}',
                 'Content-Type': 'application/json', 'Prefer': 'return=minimal'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read()


def troca(txt, stats):
    def sub(m):
        w = m.group(0); lw = w.lower()
        if lw in MAPA:
            novo = MAPA[lw]
            if w[0].isupper(): novo = novo[0].upper() + novo[1:]
            if w.isupper(): novo = novo.upper()
            if novo != w: stats[0] += 1
            return novo
        return w
    t = re.sub(r'[A-Za-zÀ-ÿ]+', sub, txt)
    stats[1] += len(RE_ESTA.findall(t)) + len(RE_EUM.findall(t))
    t = RE_ESTA.sub(lambda m: ('Está' if m.group(1)[0] == 'E' else 'está') + m.group(2), t)
    t = RE_EUM.sub(r'\1É\2', t)
    return t


def anda(v, chave_campo, stats):
    if isinstance(v, str):
        return v if chave_campo in PULAR else troca(v, stats)
    if isinstance(v, list):
        return [anda(x, chave_campo, stats) for x in v]
    if isinstance(v, dict):
        return {k: anda(x, k, stats) for k, x in v.items()}
    return v


def main():
    aplicar = '--aplicar' in sys.argv
    chave = achar_chave()
    bruto = api(chave, 'GET', 'google_reports?select=id,slug,client_name,metrics,analysis&order=created_at.desc')
    rows = json.loads(bruto)
    print(f'relatorios no banco: {len(rows)}')

    aqui = pathlib.Path(__file__).parent
    stamp = datetime.datetime.now().strftime('%Y%m%d_%H%M')
    bkp = aqui / f'backup_relatorios_{stamp}.json'
    bkp.write_text(json.dumps(rows, ensure_ascii=False))
    print(f'backup original salvo: {bkp}')

    mudados = 0
    for r in rows:
        st = [0, 0]
        met = anda(r.get('metrics'), '', st)
        ana = anda(r.get('analysis'), '', st)
        if st[0] + st[1] == 0:
            continue
        mudados += 1
        print(f"  {r['client_name'][:26]:28} {st[0]+st[1]:4} palavras corrigidas")
        if aplicar:
            api(chave, 'PATCH', f"google_reports?id=eq.{r['id']}", {'metrics': met, 'analysis': ana})

    if aplicar:
        print(f'\nGRAVADO: {mudados} relatorios corrigidos no banco.')
        print('Confira um: https://central.svicompany.com.br/r/alpha-fitness-agosto-de-2026-iguv')
    else:
        print(f'\nDRY-RUN: {mudados} relatorios seriam corrigidos. Nada foi gravado.')
        print('Pra aplicar: python3 scripts/acentuar_relatorios_gmn.py --aplicar')


if __name__ == '__main__':
    main()
