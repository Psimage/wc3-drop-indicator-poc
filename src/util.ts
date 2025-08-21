
export function id2FourCC(id: number): string {
    const a = (id >>> 24) & 0xff;
    const b = (id >>> 16) & 0xff;
    const c = (id >>> 8) & 0xff;
    const d = id & 0xff;
    return string.char(a, b, c, d);
}