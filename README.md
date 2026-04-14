# Therapy Scheduler

Projeto inicial para o app de agendamento presencial de terapias.

## Estrutura
- `src/models.ts` — modelos de dados e validações de reserva
- `src/db.ts` — armazenamento JSON leve e persistente
- `src/index.ts` — inicialização do banco e criação das tabelas

## Como usar
1. Instale dependências: `npm install`
2. Inicialize o banco: `npm run validate`
3. Inicie o servidor: `npm start`

O servidor expõe endpoints HTTP para registro e login:
- `POST /register`
- `POST /login`

### Exemplo de registro
```bash
curl -X POST http://localhost:4000/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"João","phone":"(11) 99999-9999","address":"Rua A, 123","referredBy":"Instagram","username":"joao","password":"senha123"}'
```

### Exemplo de login
```bash
curl -X POST http://localhost:4000/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"joao","password":"senha123"}'
```

## Escopo desta primeira task
- Modelos de paciente, sala/terapia e reserva
- Validação de duração 60/120 minutos
- Intervalo mínimo de 15 minutos entre reservas na mesma sala
- Registro de pacientes com usuário e senha
- Login de pacientes via API HTTP
