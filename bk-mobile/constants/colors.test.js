// Import from colors.js (the CommonJS wrapper)
const { DarkColors, LightColors } = require('./colors.js');

describe('color tokens', () => {
  it('dark theme has all required tokens', () => {
    expect(DarkColors.bg).toBe('#06100f');
    expect(DarkColors.surface).toBe('#0e1c1c');
    expect(DarkColors.brand).toBe('#008b8b');
    expect(DarkColors.accent).toBe('#40e0d0');
    expect(DarkColors.fg).toBe('#e0ffff');
    expect(DarkColors.muted).toBe('#7aa8a8');
    expect(DarkColors.danger).toBe('#ff5f6d');
  });

  it('light theme has all required tokens', () => {
    expect(LightColors.bg).toBe('#f7f8fa');
    expect(LightColors.surface).toBe('#ffffff');
    expect(LightColors.brand).toBe('#006d6f');
    expect(LightColors.fg).toBe('#0d1a1a');
  });
});
