import { FuelGrade } from './types';

export const ALL_FUEL_GRADES: FuelGrade[] = [
  'SUPER',
  'GASOIL',
  'KEROSENE',
  'LPG_BULK',
  'HEAVY_FUEL',
];

export function formatFcfa(amount: number): string {
  const rounded = Math.round(amount);
  const formatted = new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  })
    .format(rounded)
    .replace(/\u202f|\u00a0/g, ' ');
  return `${formatted} FCFA`;
}

export function formatLitres(litres: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(litres);
  return `${formatted} L`;
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function gradeLabel(grade: FuelGrade): string {
  switch (grade) {
    case 'SUPER':
      return 'Super Sans Plomb (SP95)';
    case 'GASOIL':
      return 'Diesel / Gasoil';
    case 'KEROSENE':
      return 'Kerosene / Pétrole';
    case 'LPG_BULK':
      return 'LPG Gaz / GPL';
    case 'HEAVY_FUEL':
      return 'Heavy Fuel / Generator';
  }
}
