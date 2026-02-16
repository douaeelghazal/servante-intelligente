const chromadb = await import('chromadb-default-embed');
console.log('Exports disponibles:', Object.keys(chromadb));
console.log('Type de default:', typeof chromadb.default);
console.log('Type de ChromaClient:', typeof chromadb.ChromaClient);
console.log('chromadb.default:', chromadb.default);