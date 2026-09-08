/**
 * Query keys for baskets, in one place so a mutation and the query it
 * invalidates can never drift apart.
 */

export const basketsKey = () => ["baskets"] as const;
export const basketKey = (id: string) => ["baskets", id] as const;
