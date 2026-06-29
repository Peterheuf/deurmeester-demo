/**
 * Vercel serverless entry — export Express app directly (@vercel/node handles it).
 * Dynamic routes are rewritten here via vercel.json.
 */
module.exports = require('../server');
