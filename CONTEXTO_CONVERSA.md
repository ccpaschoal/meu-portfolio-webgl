# Contexto Completo da Conversa e Arquitetura do Portfólio WebGL

Este documento consolida todo o histórico, decisões de design, soluções matemáticas/técnicas e estado atual do projeto do **Portfólio 3D WebGL de Camilla Paschoal** para referência completa do Gemini e futuras iterações.

---

## 1. Visão Geral e Localização

- **Diretório no Disco**: `C:\Users\paschoal\Desktop\12 - MEU PORTFÓLIO WEBGL`
- **Ambiente & Ferramentas**:
  - Windows, Navegador padrão: **Microsoft Edge** (`channel: 'msedge'`)
  - **Three.js** (WebGL 3D nativo, ACESFilmicToneMapping, renderizador único sem DOM no 3D)
  - **GSAP** (animações, master timeline virtualizada de 0.0 a 1.0)
  - **Vite** (servidor dev em background na porta `5173`)
  - **Playwright** (`tests/cinematic.mjs` para testes automatizados ponta a ponta)

---

## 2. Estrutura dos Atos Narrativos da Cena 3D

1. **Prólogo / Teaser (Tela Escura Inicial)**:
   - Fundo cósmico com 6.500 partículas de poeira 3D dual-tone (ouro e azul-ciano) com rastro interativo do cursor.
   - Chamada central: seta descendente animada e texto em destaque `"CLIQUE OU ROLE"` em fonte mono branca e nítida.
   - Disparo por clique ou scroll: o maço de 3 polaroids sobe com ritmo nobre e se desdobra em leque.
2. **Ato 00 — Matriz (Polaroids 3D)**:
   - Tríptico de fotografias polaroid com sombreamento físico, textura acetinada e inclinações orgânicas.
   - Saída suave em elevação vertical conforme a rolagem avança.
3. **Ato 01 — Película (Fita Kodak 35mm Cinematográfica)**:
   - Fita contínua em acetato preto acetinado (`#070709`) com perfurações duplas (topo e base).
   - Curvatura espacial 3D orgânica contínua (estilo Hiago.dev) com ondulação senoidal em Y, profundidade em Z e inclinação/banking sutil.
   - Entrada serpentina (*snake slither*) vindo do fundo e do canto com torção fluida.
   - **Dois carrosséis panorâmicos contínuos**:
     - *Carrossel 01 (Apresentação)*: 6 lâminas unidas perfeitamente (gap 0).
     - *Espaçador*: respiro editorial de 36 unidades.
     - *Carrossel 02 (Aura - Fone S3 Air)*: 4 lâminas contínuas panorâmicas unidas sem cortes nem faixas pretas.
     - *Tail final*: `◄ END ROLL / EXP 36A`.
4. **Ato 02 — Digital (Smartphone Hero 3D Monolítico)**:
   - Smartphone 3D proporcional e realista, com chanfro (bevel), lente da câmera, reflexos e proporção matemática 1:1 com telas mobile (780x1688).
   - Surge do fundo profundo (`z: -900` para `z: 40`) e permanece visível durante a leitura dos sites de Camilla (Aconchego, Vanessa Chaves, Chapa 62, Loja AURA).
   - Tipografia narrativa na lateral: `"ADAPTÁVEL. VAMOS DESCOBRIR"` e `"DO SEU JEITO. O QUE MAIS COMBINA COM VOCÊ?"` surgindo letra por letra (split-text estilo Vanessa Chaves).
   - Resposta imediata ao scroll (lerp ágil de 0.18 sem latência ou atraso de resposta).
5. **Ato 03 — Arquivo (Reprodutor VHS e Fita Cassete Interativa)**:
   - Fita cassete com bobinas giratórias, fita magnética física e botões de contato tátil (WhatsApp, LinkedIn, GitHub, E-mail).
   - Display CRT superior do deck: `PASCHOAL T-120 · MASTER DECK 00:26:14` e `▶ PLAY SP STEREO CH-1/2` com fósforo ciano/verde e LED físico, 100% visível e sem corte pela carcaça.

---

## 3. Histórico de Solicitações e Soluções Implementadas

### 1. Velocidade da rolagem e sensibilidade do celular
- **Problema**: O celular demorava para responder ao rolar a página.
- **Causa**: O clamp de scroll estava limitado a `[-80, 80]` com fator `0.00018` e um lerp lento de `0.08` no loop de animação (demorava até 400-500ms para atingir o destino).
- **Solução em `src/main.js`**:
  - `SCROLL_FACTOR` ajustado para `0.00030` com clamp de `[-140, 140]`.
  - Lerp no `updateScrollLoop` ajustado para `0.18`. O celular agora responde no mesmo instante em que a usuária gira a roda do mouse, mantendo suavidade visual.

### 2. "CLIQUE OU ROLE" maior e com fonte branca
- **Problema**: O texto do teaser na tela escura era pequeno (`0.68rem`) e cinza opaco.
- **Solução em `src/style.css`**:
  - `.teaser-hint`: aumentado para `0.95rem`, peso `700`, cor `#ffffff` pura, espaçamento `0.35em` e brilho sutil `drop-shadow`.
  - `.teaser-arrow`: aumentado com traço branco de 2px e sombra suave.

### 3. Display VHS cortado ("isso ta cortado tbm")
- **Problema**: A linha inferior do display CRT (`▶ PLAY SP STEREO CH-1/2`) ficava parcialmente escondida atrás do trilho/borda superior do deck VHS.
- **Causa**: O mesh do display estava em `y: 198, z: -20` com altura de 48px, enquanto o trilho superior estava em `y: 171, z: 38`, projetando-se à frente do texto inferior.
- **Solução em `src/scene.js`**:
  - Altura do canvas do display ampliada para 140px (proporção limpa).
  - Posição do mesh `deckTitle` ajustada para `y: 218, z: 12`, bem acima do trilho e à frente do painel traseiro.
  - O LED e a luz pontual foram alinhados em `y: 218`. As duas linhas do display e o contador `00:26:14` aparecem com 100% de visibilidade.

### 4. Ritmo das polaroids no teaser
- **Problema**: As polaroids subiam e abriam rápido demais após o clique/rolagem.
- **Solução em `src/scene.js` (`triggerTeaserReveal`)**:
  - Subida do maço desacelerada de `0.65s` para `0.95s` com `power2.out`.
  - Abertura em leque espaçada para `0.85s`, conferindo elegância e peso físico à transição.

### 5. Letras surgindo letra por letra (estilo Vanessa Chaves)
- **Problema**: A usuária pediu que as letras escritas dos títulos narrativos surgissem como no site da Vanessa Chaves (`uploaded_media_11_1794294999082.png`).
- **Solução**:
  - Em `src/main.js`: script que divide os títulos (`.phone-headline`, `.phone-subcopy`) em palavras e caracteres (`.ch`), injetando a variável CSS `--c` sequencialmente.
  - Em `src/style.css`: cada caractere nasce com `opacity: 0; transform: translateY(0.28em); filter: blur(4px)` e transiciona sequencialmente com atraso `calc(var(--c) * 26ms + 120ms)` assim que o Capítulo 02 se torna ativo.

### 6. Carrossel AURA separado e com fotos cortadas
- **Problema**: No carrossel do Aura na fita 35mm, as imagens apareciam com faixas pretas e textos cortados nas bordas (*35H DE BATERIA*, *LIBERDADE SONORA*, *CONEXÃO ULTRAESTÁVEL* etc.).
- **Diagnóstico Matemático**: A fita de película possui curvatura senoidal contínua (`zOffset`). Na região do Aura (vale da senoide, côncavo em relação à câmera), planos rígidos tangentes tinham suas bordas ultrapassadas pela malha de acetato preto da película por até 1.76 unidades, sobrepondo-se em preto sobre as imagens.
- **Solução em `src/scene.js`**:
  - Cada fotograma e tail receberam malhas subdivididas (`PlaneGeometry` com 24 segmentos horizontais).
  - Cada vértice calcula sua coordenada Z local para garantir que, em espaço de mundo, fique exatamente `+2.5` unidades à frente da película em todos os pontos.
  - Os slides unem-se com gap 0 perfeito, restaurando 100% da integridade visual contínua.

### 7. Fotos Flutuantes sem Moldura de Fita (Visual Limpo e Edição Direta)
- **Decisão**: A moldura preta de película (acetato, perfurações, leader e tail) foi removida, permitindo que as lâminas dos carrosséis flutuem 100% puras no espaço 3D.
- **Benefícios**:
  - Eliminação total de qualquer risco de corte, sombra indesejada ou desalinhamento.
  - Carrosséis contínuos panorâmicos (como *Apresentação* e *AURA*) unem-se com precisão milimétrica de ponta a ponta (gap 0).
  - Entrada sedosa e contínua das lâminas (suave aproximação em Z, escala e leve deslocamento em X sem solavancos).
  - Facilidade absoluta para incluir ou trocar carrosséis na narrativa.

### 8. Display CRT VHS 100% Desobstruído
- **Problema**: A linha inferior `▶ PLAY SP STEREO CH-1/2` e a moldura ciano do display CRT do VHS continuavam parcialmente cobertas pelo trilho metálico e bezel frontal do deck.
- **Causa**: O mesh do display estava em `z: 12` (atrás dos trilhos frontais em `z: 38`), de modo que a perspectiva ascendente da câmera (`y: 0` projetando sobre `y: 171`) recortava a metade inferior do visor.
- **Solução em `src/scene.js`**:
  - `deckTitle` posicionado na face frontal do topo do deck em `y: 230, z: 46` (à frente dos trilhos em `z: 38`), com linha de texto inferior recuada para `y: 92` no canvas (48px de respiro inferior).
  - `led` e `ledLight` alinhados em `y: 230, z: 46/54`.
  - Visibilidade e integridade de 100% comprovadas por captura headless no Microsoft Edge.

### 9. Movimento da Poeira 3D & Mouse Tilt das Polaroids
- **Problema**: A poeira precisava de um movimento orgânico suave (sem agitação excessiva) e as 3 polaroids precisavam reagir ao mouse com uma leve inclinada tátil.
- **Solução em `src/scene.js`**:
  - **Poeira**: Velocidade calibrada em ritmo sereno (`uTime.value += 0.012`), com correntes suaves no vertex shader (16px em X, 15px em Y, 12px em Z) e turbulência sutil ao passar o cursor, mantendo `uRadius = 75.0` exigido pelos testes automatizados.
  - **Polaroids**: Parallax com lerp suave em `rotation.y` e `rotation.x` no `chapter00Group` e em cada polaroid individualmente em `animate()`, mantendo o `rotation.z` do leque e descarte do GSAP 100% intactos.

### 10. Calibração do LED do Deck VHS
- **Ajuste**: Raio da esfera da bolinha LED do VHS ampliado de 7 para 13 em [`SphereGeometry(13, 24, 16)`](src/scene.js) com luz pontual de raio 140 e intensidade 2.0, conferindo presença marcante de hardware vintage.

### 11. Lâminas Fotográficas Livres e Soltas no Espaço 3D
- **Ajuste**: As lâminas dos carrosséis (Apresentação e Aura) foram desacopladas da rigidez de um bloco fixo:
  - Cada lâmina agora é uma peça independente no array [`filmSlides`](src/scene.js), com flutuação vertical desacoplada (`floatY = sin(t * 1.3 + i * 0.72) * 4.5`) e rotação sutil em Z e X reagindo ao cursor do mouse.
  - As lâminas panorâmicas unem-se perfeitamente de ponta a ponta quando em exibição, mas com peso físico, respiro e liberdade espacial 3D.

### 12. Entrada Desacelerada e Majestosa do Deck VHS
- **Ajuste**: O reprodutor VHS e a fita cassete estavam surgindo rápido demais:
  - Duração do deslizamento do `vhsPlayer` aumentada de 6s para 9.5s com curva suave `power1.out`.
  - Ascensão da fita cassete `vhsCassette` estendida de 10s para 13.5s com `power2.inOut`, partindo de `y: -720` para um encaixe mecânico deliberado, pesado e cinematográfico.

### 13. Polaroids Soltas com Inclinação Totalmente Independente
- **Ajuste**: A rotação do grupo pai `chapter00Group` no loop `animate()` foi fixada em zero, de modo que as três polaroids não inclinam mais juntas como um bloco colado.
- Cada uma agora possui rotação tátil individual com resposta de pitch/yaw própria ao cursor do mouse, dando a sensação de três fotografias físicas flutuando soltas no ar.

### 14. Eliminação de Snap e Cadência na Abertura do Teaser
- **Ajuste**: O maço de polaroids inicia pré-empilhado na base em `y: -650` desde a inicialização em `buildChapter00()`.
- Na transição `triggerTeaserReveal()`, as colisões de interpolação sobre a coordenada Y foram eliminadas: elevação contínua em 1.25s e desdobramento gradual em leque a partir dos 0.28s com `power2.out`, com abertura sedosa e sem nenhum solavanco.

### 15. Entrada Solta e Escalonada em Onda Senoidal 3D (Ato 01)
- **Problema**: As fotos de película ainda entravam juntas em bloco linear, sem o efeito orgânico serpentino de onda senoidal.
- **Solução em `src/scene.js`**:
  - Cada lâmina agora entra de forma desacoplada com escalonamento temporal (`startT = 21.0 + i * 0.24s`).
  - Cada uma parte de sua própria fase senoidal 3D no espaço (`wavePhase = i * 0.62`), ondulando em Y (`Math.sin(wavePhase * 2.0) * 35`), curvando em profundidade Z e inclinando em `rotY` e `rotZ` na curva da senoide.
  - Elas chegam uma a uma como uma serpente fluida de lâminas soltas, assentando-se perfeitamente no centro aos 25s com os panoramas contínuos unificados.

### 16. Fotos Surgindo do Lado Esquerdo para a Direita (Ato 01 & Teaser)
- **Ajuste**: Anteriormente, a fita/carrossel entrava a partir da direita (`x: 900`).
- **Solução em `src/scene.js`**:
  - Em [`initMasterTimeline`](src/scene.js#L1367): o grupo `kodakFilmStrip` agora nasce do lado esquerdo profundo (`x: -1150, z: -420`) com leve ângulo `rotation.y = -0.12` e navega suavemente para a direita até o centro (`x: 0, z: 0`).
  - Cada lâmina fotográfica do carrossel inicia com deslocamento à esquerda de sua posição base (`baseX - 280 - sin(wavePhase) * 60`), deslizando da esquerda para a direita de forma escalonada (`startT = 21.0 + i * 0.24s`).
  - No Prólogo / Teaser [`triggerTeaserReveal`](src/scene.js#L1558), as polaroids também desdobram em cascata da esquerda para a direita (esquerda em 0.0s/0.20s, centro em 0.08s/0.28s e direita em 0.16s/0.36s).

### 17. Chassis do VHS Mais Rápido & Inserção Mecânica Cadenciada da Fita
- **Ajuste**: O reprodutor VHS (`vhsPlayer`) agora surge com rapidez e firmeza em 5.5s com curva `power2.out`, assentando na mesa no início do Ato 03.
- A fita cassete (`vhsCassette`) em si mantém sua velocidade cadenciada e solene (13.8s com `power1.inOut`), elevando-se e inserindo-se na gaveta com altíssima precisão de encaixe mecânico.

### 18. Retorno à Tela Preta do Teaser ("CLIQUE OU ROLE") ao Voltar a Rolagem
- **Problema**: A usuária não conseguia voltar para a tela inicial escura ao rolar para cima; o prólogo era destruído do DOM, exigindo recarregar a página (F5).
- **Solução**:
  - Em `src/main.js`: o elemento `#intro-teaser` é preservado com `opacity: 0; pointerEvents: 'none'` em vez de sofrer `.remove()`.
  - Ao rolar para cima quando já no topo absoluto (`currentProgress <= 0.001` e `deltaY < -12`), ou ao clicar no botão "00 MATRIZ" já estando nele, é disparado `returnToTeaser()`.
  - Em `src/scene.js`: método [`hideToTeaser()`](src/scene.js#L1634) fecha o leque das polaroids de volta para o centro e desce o maço para `y: -650`, restaurando a classe `is-teaser` e reexibindo o prompt minimalista `"CLIQUE OU ROLE"` com sua seta animada.

### 19. Carrossel Apresentação: Lâminas de Cantos Extremos Fora de Tela, Calma e Montagem no Centro
- **Ajuste & Simplificação**:
  - O carrossel Aura foi removido conforme solicitação da usuária, concentrando o Ato 01 nas 6 lâminas panorâmicas da Apresentação.
  - **Entrada de fora da tela**: todas as 6 lâminas são pré-posicionadas fora dos limites do viewport (`X: ±2000 a ±2200, Y: ±1350 a ±1500`) às 21.0s com opacidade 0, eliminando qualquer risco de aparecerem perto do centro antes do voo.
  - **Voo devagar e cadenciado**: velocidade desacelerada com curva suave `power1.out` ao longo de 4.2s (`startT = 21.0 + i * 0.30s`), voando dos cantos externos para o meio da tela.
  - **Montagem no centro da visão**: unem-se com gap 0 perfeito formando o banner panorâmico unificado, centralizado simetricamente no meio da tela (`kodakFilmStrip.position.x = -440`).
  - **Saída por cantos opostos (42.5s a 47.5s)**: ao continuar a rolagem, as lâminas se desprendem e dispersam para cantos externos fora da tela com opacidade 0, liberando o espaço para o Smartphone Monolítico surgir às 48.0s.

### 20. Harmonização e Calibração da Rolagem Contínua
- **Problema**: A rolagem parecia desconfigurada devido a fatores de tração díspares entre atos (`SCROLL_FACTOR = 0.00030` com corte repentino de `0.38` no VHS).
- **Solução**:
  - `SCROLL_FACTOR` calibrado de forma uniforme para `0.00018` em toda a narrativa (tanto no mouse wheel quanto no touch mobile).
  - Cada ato recebe aproximadamente 14 passos de rolagem equilibrados e homogêneos, permitindo contemplação natural de cada fase narrativa sem solavancos.

### 21. Frame do Reprodutor VHS Deslizando Direto do Canto Esquerdo
- **Problema**: O chassi do deck VHS nascia em `x: -320`, ocupando parte da tela no momento em que `chapter03Group` se tornava visível, dando a sensação de "aparecer do nada".
- **Solução em `src/scene.js`**:
  - Em [`buildChapter03()`](src/scene.js#L1245): `this.vhsPlayer` é pré-estacionado completamente fora do viewport em `x: -1500`.
  - Em [`initMasterTimeline()`](src/scene.js#L1536): o reprodutor desliza suavemente em 4.8s vindo direto da extremidade esquerda da tela (`x: -1500` para `x: 0`) com leve inclinação física em `rotY: 0.12`, eliminando qualquer efeito de surgimento repentino.
  - A fita cassete em si mantém sua subida solene e cadenciada a partir de `y: -720` em 13.8s, encaixando na gaveta com perfeição.

### 22. Sincronização dos Cliques de Capítulos com Rolagem e Desbloqueio do Palco
- **Problema**:
  - Ao clicar nos capítulos do tracker lateral, o último (03 ARQUIVO) não funcionava / ficava vazio, no segundo (01 PELÍCULA) as fotos ficavam em pleno voo e não encaixavam, e no terceiro (02 DIGITAL) o celular parava no meio do caminho com escala reduzida e não completava a viagem de aparecer. Além disso, ao retomar a rolagem após clicar, ocorria descompasso.
- **Causas Identificadas**:
  1. *Destinos de navegação nos limites de corte e não nos platôs montados*: o código usava `[0, 25, 50, 75] / 100`. Em 75s, o VHS mal começara a deslizar de `x: -1500` e a cassete estava em `y: -720` (tela vazia). Em 50s, o smartphone estava apenas no segundo 2 de um voo de 7s (preso a `scale: 0.34` e `z: -550`). Em 25s, as fotos ainda estavam em trajetória de entrada (só convergem e unem em 26.5s).
  2. *Bloqueio de cliques por sobreposição de container*: `.phone-stage` possuía `z-index: 91` e `pointer-events: auto` cobrindo a tela inteira quando ativo, ficando acima do `.chapter-tracker` (`z-index: 90`), interceptando os cliques no tracker.
  3. *Dessincronização de variáveis de scroll*: `targetProgress` e `currentProgress` não eram atualizados no tween de navegação, fazendo a rolagem posterior saltar.
- **Soluções Implementadas**:
  - Em [`src/style.css`](src/style.css#L119): `.chapter-tracker` elevado para `z-index: 95`. `.phone-stage` mantido com `pointer-events: none` (apenas os botões de seta `.site-arrow` possuem `pointer-events: auto`), permitindo cliques 100% desobstruídos no tracker e no raycaster 3D.
  - Em [`src/main.js`](src/main.js#L187): destinos recalibrados para os platôs de estabilidade:
    - `00 MATRIZ`: `0.00` (polaroids abertas).
    - `01 PELÍCULA`: `0.35` (35s: 6 lâminas unidas no centro com gap 0).
    - `02 DIGITAL`: `0.60` (60s: smartphone pousado em `z: 40`, escala 1.0, textos e setas ativos).
    - `03 ARQUIVO`: `0.90` (90s: reprodutor em `x: 0`, fita encaixada em `y: -30, z: 0`, LED aceso e botões de contato ativos).
  - Em [`src/main.js`](src/main.js#L106): sincronização em tempo real de `currentProgress` e `targetProgress` durante e ao finalizar o tween, garantindo continuidade suave e sem snap na rolagem contínua.

### 23. Salto Direto de Capítulos Finalizando a Montagem no Centro
- **Problema**: Ao mudar de capítulo pelo índice (menu lateral direito), a animação percorria a timeline inteira acelerada, fazendo todos os objetos intermediários (fotos do carrossel, celular) piscarem e voarem pela tela.
- **Solução & Dinâmica Cinemática**:
  - Em [`index.html`](index.html#L18): inclusão de `<div id="chapter-curtain" class="chapter-curtain"></div>`.
  - Em [`src/style.css`](src/style.css#L248): cortina com gradiente sutil `#030305`, `pointer-events: none` e `z-index: 94` (abaixo do tracker `95`, cobrindo cena 3D e palco).
  - Em [`src/main.js`](src/main.js#L201): [`navigateToChapter()`](src/main.js#L201) executa um corte rápido de 140ms para o escuro, salta diretamente para o ponto de finalização da montagem daquele ato (`assemblyStarts: [0.04, 0.235, 0.50, 0.82]`) e anima suavemente em 0.9s até o platô estável (`[0.00, 0.35, 0.60, 0.90]`):
    - **01 PELÍCULA**: as 6 fotos chegam convergindo dos cantos e fecham no centro com gap 0.
    - **02 DIGITAL**: o smartphone conclui sua aproximação de z e escala 1.0, enquanto o texto narrativo revela.
    - **03 ARQUIVO**: o deck já está no centro e a fita cassete conclui sua subida e encaixe na baia com o LED acendendo.
    - **00 MATRIZ**: as polaroids assentam suavemente na posição de leitura.
  - Zero objetos intermediários são exibidos durante o salto, e a rolagem manual por scroll contínuo permanece 100% íntegra.

### 24. Desaceleração Cadenciada e Eliminação de Saltos na Montagem do Carrossel
- **Problema**: O carrossel montava rápido demais e apresentava um "snap/salto" no início da entrada.
- **Causas**:
  1. Distâncias externas hiperbólicas (`X: ±2200, Y: ±1400`) exigiam velocidade excessiva (620 unidades/s).
  2. Duração muito curta (`dur: 4.2s`) com curva inicial brusca (`power1.out`).
  3. Zoom composto concorrente no container `kodakFilmStrip` que continuava acelerando as fotos até 28.5s após a união.
- **Solução em [`src/scene.js`](src/scene.js#L1360)**:
  - Distâncias de nascimento calibradas (`X: ±1000 a ±1100, Y: ±700 a ±760`) imediatamente fora da visão sem exagero.
  - Duração de voo quase dobrada para **8.0s** com curva suave de desaceleração aerodinâmica **`power2.out`**.
  - Fade de opacidade suave estendido para 5.2s, materializando as fotos gradualmente conforme se aproximam.
  - Sincronização da escala e aproximação Z do container em 8.5s, garantindo que todo o conjunto pouse no centro ao mesmo tempo sem duplo movimento.

### 25. Saída Gradual e Serena do Carrossel (Fim do Efeito Catapulta)
- **Problema**: O carrossel saía da tela rápido demais ("parece que a rolagem tá atirando ele pra fora").
- **Causa**: Curva de aceleração `power2.in` (que ganha velocidade máxima no final), duração de apenas 4.0s e offsets de saída muito distantes.
- **Solução em [`src/scene.js`](src/scene.js#L1419)**:
  - Curva trocada para **`sine.inOut`**, proporcionando uma transição aveludada, constante e sem aceleração brusca.
  - Duração mais que dobrada de 4.0s para **8.5s**, espalhada serenamente de 38.5s a 48.5s.
  - Offsets de dispersão calibrados para as bordas do viewport (`X: ±650 a ±750, Y: ±520 a ±560`) com fade out de opacidade estendido para 6.5s.
  - Transição perfeita e sem buraco preto com o nascimento do smartphone monolítico às 48.0s.

---

## 4. Como Executar e Validar

1. **Iniciar servidor local**:
   ```powershell
   cd "C:\Users\paschoal\Desktop\12 - MEU PORTFÓLIO WEBGL"
   node node_modules/vite/bin/vite.js
   ```
   Acesse: `http://localhost:5173` no Microsoft Edge.

2. **Executar bateria de testes automatizados**:
   ```powershell
   cd "C:\Users\paschoal\Desktop\12 - MEU PORTFÓLIO WEBGL"
   node tests/cinematic.mjs
   ```
   *Status*: 100% dos testes passando com sucesso.
