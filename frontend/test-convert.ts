import { convertToModelMessages } from "ai";

const msgs = [{ id: '1', role: 'user', content: 'Hi' }];
const fixed = msgs.map(m => m.parts ? m : { ...m, parts: [{ type: 'text', text: m.content }] });
convertToModelMessages(fixed).then(console.log);
