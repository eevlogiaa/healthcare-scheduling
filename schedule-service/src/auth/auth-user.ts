/** User yang lagi login, hasil dari query `validateToken` di Auth Service. */
export interface AuthUser {
  id: string;
  email: string;
}
