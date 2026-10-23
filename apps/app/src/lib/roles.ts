import { User } from '../types/entities';

export const roleLabel = (role: User['role']) => {
  if (role === 'admin') return 'Building admin';
  if (role === 'apartment_admin') return 'Apartment admin';
  if (role === 'guest') return 'Guest';
  return 'Resident';
};

export const roleDescription = (role: User['role']) => {
  if (role === 'admin') return 'Manages every apartment, person, and door setting.';
  if (role === 'apartment_admin') return 'Manages people and access for their own apartment.';
  if (role === 'guest') return 'Gets in with a PIN or card, optionally only at scheduled times.';
  return 'Can open the door with the app, a PIN, or a card.';
};
