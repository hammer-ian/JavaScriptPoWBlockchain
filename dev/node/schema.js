const Joi = require('joi');
const logger = require('../utils/logger');

// Define and validate  schema for a new transaction object
const newTransactionSchema = Joi.object({
    debitAddress: Joi.string().required(),
    creditAddress: Joi.string().required(),
    gas: Joi.number().positive().required(),
    amount: Joi.number().positive().required()
});
// Middleware for validating transactions
const validateTransactionJSON = (req, res, next) => {
    const { error } = newTransactionSchema.validate(req.body);
    if (error) {
        logger.error(`Transaction JSON failed schema validation ${error.details[0].message}`);
        return res.status(400).send({ error: `${error.details[0].message}` });
    }
    next();
};


module.exports = {
    validateTransactionJSON
};