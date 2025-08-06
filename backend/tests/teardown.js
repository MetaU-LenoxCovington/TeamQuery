"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/lib/prisma");
const logger_1 = require("../src/utils/logger");
const sessionServiceSingleton_1 = require("../src/services/sessionServiceSingleton");
exports.default = () => __awaiter(void 0, void 0, void 0, function* () {
    logger_1.logger.info('Running global test teardown...');
    try {
        sessionServiceSingleton_1.sessionService.stopCleanupInterval();
        // Final cleanup
        yield prisma_1.prisma.$disconnect();
        logger_1.logger.info('Test teardown completed successfully');
    }
    catch (error) {
        logger_1.logger.error('Error during test teardown:', error);
    }
});
