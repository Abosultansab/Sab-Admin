import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { collection, onSnapshot, query, Query, DocumentData } from 'firebase/firestore';

export function useFirestoreCollection<T extends { id: string }>(
  collectionName: string,
  queryConstraints?: (q: Query<DocumentData>) => Query<DocumentData>
) {
  const queryClient = useQueryClient();
  const queryKey = [collectionName];

  const firestoreQuery = useQuery({
    queryKey,
    queryFn: () => [] as T[],
    staleTime: Infinity,
  });

  useEffect(() => {
    console.log(`[useFirestoreCollection] Setting up real-time listener for: ${collectionName}`);
    
    let q = query(collection(firestoreQuery.data as any, collectionName));
    
    if (queryConstraints) {
      q = queryConstraints(q);
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        console.log(`[useFirestoreCollection] ${collectionName} updated:`, snapshot.docs.length, 'documents');
        
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];

        queryClient.setQueryData(queryKey, data);
      },
      (error) => {
        console.error(`[useFirestoreCollection] Error listening to ${collectionName}:`, error);
      }
    );

    return () => {
      console.log(`[useFirestoreCollection] Cleaning up listener for: ${collectionName}`);
      unsubscribe();
    };
  }, [collectionName, queryClient]);

  return firestoreQuery;
}
