const mem: Record<string, string> = {};
export default {
  getItem: async (k: string) => mem[k] ?? null,
  setItem: async (k: string, v: string) => { mem[k] = v; },
  removeItem: async (k: string) => { delete mem[k]; },
  __reset: () => { for (const k of Object.keys(mem)) delete mem[k]; },
};
