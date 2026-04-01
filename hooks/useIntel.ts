import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { CollectionName, IntelNote } from '../types';
import { useAuth } from '../contexts/AuthContext';

export const useIntel = () => {
    const { currentUser, userProfile } = useAuth();
    const [notes, setNotes] = useState<IntelNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, CollectionName.NOTAS_INTEL),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedNotes = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as IntelNote));
            setNotes(fetchedNotes);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching intel notes:", err);
            setError("Erro ao carregar insights.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const createNote = async (text: string) => {
        if (!currentUser || !userProfile) return;

        try {
            // Primeiro salvamos a nota bruta no sistema para processamento
            // No fluxo da Sprint 16, vamos chamar o backend que fará todo o trabalho
            const response = await fetch('/api/intel/notas', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text,
                    userId: currentUser.uid,
                    userName: userProfile.displayName
                }),
            });

            if (!response.ok) {
                throw new Error('Falha ao processar nota via IA');
            }

            return await response.json();
        } catch (err) {
            console.error("Error creating intel note:", err);
            throw err;
        }
    };

    return { notes, loading, error, createNote };
};
