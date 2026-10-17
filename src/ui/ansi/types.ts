export interface AnsiImage { w: number; h: number; d: string }
export interface AnsiSprite extends AnsiImage { x: number; y: number }
export interface AnsiBank {
  bg: Record<'forest' | 'training' | 'lair', AnsiImage>;
  village: AnsiImage;
  logo: AnsiImage;
  sprites: Record<string, AnsiSprite>;
}
