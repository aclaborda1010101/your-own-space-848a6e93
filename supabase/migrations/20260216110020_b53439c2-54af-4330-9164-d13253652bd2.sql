-- Clean contaminated people arrays in existing conversation_embeddings

-- Reunión sobre campañas: only Agustín and Raúl speak
UPDATE conversation_embeddings
SET people = ARRAY['Agustín Cifuentes', 'Raúl Agustito']
WHERE transcription_id = 'de691b57-8a2a-4ddd-a001-7f05466b4383';

-- Mañana familiar: only Agustín, Juany and Bosco speak
UPDATE conversation_embeddings
SET people = ARRAY['Agustín Cifuentes', 'Juany', 'Bosco']
WHERE transcription_id = '286cc394-f281-4aa7-99fd-b004cb1db669';

-- Comida con amigos: speakers are anonymous (Speaker 8, 9, 10), clear the array
UPDATE conversation_embeddings
SET people = ARRAY[]::text[]
WHERE transcription_id = '95cf9ce5-c6aa-4869-8631-a80dec68c7d5';
