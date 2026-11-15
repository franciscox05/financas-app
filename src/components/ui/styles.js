// Cadeias de classes partilhadas por campos e botões. Antes cada ficheiro tinha
// a sua cópia de `inputClass`, `focusRing`, `primaryButton`, ... com pequenas
// diferenças entre cópias (alturas de 36 ou 44 px, raios, cor do foco) — era
// daí que vinham as inconsistências entre ecrãs. Agora há uma só definição;
// quem precisa de um ajuste local acrescenta classes por cima
// (ex.: `${primaryButton} flex-1`).

export const focusRing =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

// Campo de escrita ou <select>: sem borda, fundo de preenchimento, 44 px de
// altura e anel na cor de ação ao focar. O tamanho da letra (16 px) vem da
// regra global de index.css, que evita o zoom automático do iOS.
export const inputClass =
  'min-h-11 w-full min-w-0 rounded-control border-0 bg-fill px-3.5 text-label placeholder:text-label-3 focus:ring-2 focus:ring-accent disabled:opacity-50'

export const labelClass = 'mb-1.5 block text-[0.8125rem] font-medium text-label-2'

export const buttonBase = `min-h-11 rounded-control px-4 text-[0.9375rem] font-semibold transition-opacity duration-150 active:opacity-70 disabled:opacity-50 ${focusRing}`

// Ação principal do ecrã ou da folha: uma por contexto.
export const primaryButton = `${buttonBase} bg-accent-fill text-white`

// Ação secundária (Cancelar, alternativas).
export const secondaryButton = `${buttonBase} bg-fill text-label`

// Ação destrutiva: vermelho no texto sobre um fundo tingido, como no iOS — um
// botão vermelho cheio com texto branco não tem contraste no tema escuro.
export const dangerButton = `${buttonBase} bg-negative/12 text-negative`

// Ação de texto, sem fundo (ligações dentro de um cartão).
export const textButton = `${buttonBase} px-2 text-accent`
