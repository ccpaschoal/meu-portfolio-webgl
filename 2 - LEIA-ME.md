# Portfólio cinema — Camilla Paschoal

Uma página de 500vh com cenário fixo em CSS3DRenderer. Todo o conteúdo visual vem do portfólio original: 10 carrosséis, 4 mockups de sites, sua foto, fonte, logo e contatos. A versão anterior do anel está guardada em `3 - BACKUP ANEL.zip`.

## Abrir

Use **1 - ABRIR PORTFÓLIO 3D.bat** ou execute `npm.cmd run dev` nesta pasta. Endereço: http://127.0.0.1:5173/.

`npm.cmd install` instala as dependências em uma cópia nova. `npm.cmd test` inicia um servidor temporário, testa no Edge sem abrir janela e encerra esse servidor. `npm.cmd run build` gera a versão de produção.

## Sequência

1. PLAY: progresso real de imagens e fonte pelo `THREE.DefaultLoadingManager`, seguido por um voo da câmera de Z 2500 para Z 1000.
2. Película contínua: somente os carrosséis de conteúdo, ligados por faixas perfuradas em um anel 3D. A fita gira sozinha, pausa ao passar o mouse e pode ser arrastada horizontalmente. O scroll vertical apenas troca as seções. O quadro frontal ganha projeção e contraste; as imagens permanecem nítidas e o hover realça o contraste. Cada grupo tem setas internas e galeria ampliada.
3. Sites: quatro painéis de projetores independentes, com os mockups locais e links reais. No celular, o painel em foco ocupa a largura disponível.
4. Seu card vira uma foto física: retrato e descrição no mesmo papel fosco, com espessura, textura, sombra e tilt.
5. VHS: botões com símbolos mecânicos e ícones reais de LinkedIn, GitHub, Instagram, e-mail e WhatsApp. A pressão afunda o botão; a soltura devolve o rebote.

## Código

- `src/js/main.js`: conteúdo HTML, inicialização e galeria.
- `src/js/preloader.js`: controle de carregamento e progresso.
- `src/js/film-ring.js`: geometria do anel, faixas contínuas, projeção e foco.
- `src/js/projector-wall.js`: painel separado dos sites.
- `src/js/three-scene.js`: cenário, câmera, um loop de renderização, resize e tilt.
- `src/js/gsap-animations.js`: rotação automática, arraste, seleção, ScrollTrigger e transições.
- `src/css/style.css`: película, papel, plástico, grão e luz ambiente.
- `src/data/`: carrosséis, sites e contatos reais.
- `public/assets/`: imagens e recursos locais; sem fotografias de banco de imagens.
- `scripts/sync-portfolio.py`: atualiza o conteúdo a partir do HTML do portfólio original.
- `tests/cinematic.mjs` e `tests/interaction-quality.mjs`: integração, autoplay, pausa, arraste, independência do scroll, galeria e responsividade.
- `logs/`: resultados e capturas nas larguras 1440, 1024, 768 e 390.

## Ajustes e limites

O raio e a altura da película são configurados ao criar `FilmRing`, em `three-scene.js`. A escala responsiva considera a perspectiva e a projeção frontal. A faixa usa perfurações recortadas por máscara SVG: `box-shadow` não suporta o valor `dashed`.

O encaixe após arrastar usa `gsap.utils.snap` com o ângulo exato de cada quadro. ScrollTrigger controla somente as transições entre seções. Não existe um plugin GSAP separado chamado Snap. Mouse, toque, teclado, setas e navegação de capítulos estão integrados. A preferência de movimento reduzido remove o voo e os giros animados; os conteúdos e controles continuam disponíveis.

A página usa um único CSS3DRenderer e um único loop requestAnimationFrame. A renderização pausa quando a aba está oculta. Os módulos removem seus listeners e animações no recarregamento de desenvolvimento. A taxa de quadros depende do dispositivo e do navegador; a meta é 60fps, sem promessa universal de desempenho.

Referências: [CSS3DRenderer](https://threejs.org/docs/pages/CSS3DRenderer.html), [ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/), [snap](https://gsap.com/docs/v3/GSAP/UtilityMethods/snap()/), [LoadingManager](https://threejs.org/docs/pages/LoadingManager.html).


A foto e o VHS têm frente, verso e quatro laterais no espaço 3D, em src/js/physical-object.js. Os voos entre capítulos usam profundidade e rotação. Os painéis de sites fazem a aproximação e a movimentação lateral com amortecimento. A sala usa luz de projeção, sombra de chão e partículas discretas de poeira.

