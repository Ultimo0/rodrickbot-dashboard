import { Router } from 'express';
import { loadCommands } from '../store/commandsStore.js';

export const commandsRouter = Router();

// Public, comme /api/releases : le catalogue de commandes est fait pour
// être consulté par n'importe qui, pas seulement le propriétaire du bot.
commandsRouter.get('/commands', (req, res) => {
  res.json({ commands: loadCommands() });
});
