# Regenerar o Prisma Client (campo `segmento`)

Se aparecer o erro **"Unknown argument `segmento`"** ao salvar um cliente na administração, o Prisma Client precisa ser regenerado.

## Passos

1. **Pare o servidor**  
   No terminal onde está rodando `npm run dev`, pressione **Ctrl+C**.

2. **Feche outros terminais** que estejam usando o projeto (opcional, mas evita travamento de arquivo).

3. **Abra um novo PowerShell ou CMD** (fora do Cursor, se possível) e execute:
   ```bash
   cd "c:\Users\Raulinson\Desktop\Inout\Central de clientes"
   npx prisma generate
   ```

4. **Volte ao projeto** e inicie de novo:
   ```bash
   npm run dev
   ```

Ou use o script do projeto:

```bash
npm run db:generate
```

O erro acontece quando a DLL do Prisma está em uso (por exemplo pelo Next.js). Com o servidor parado, o `prisma generate` conclui e o campo `segmento` passa a ser reconhecido no `update`.
