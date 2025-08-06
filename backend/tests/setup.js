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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const prisma_1 = require("../src/lib/prisma");
const logger_1 = require("../src/utils/logger");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
beforeAll(() => __awaiter(void 0, void 0, void 0, function* () {
    process.env.NODE_ENV = 'test';
    if (!process.env.TEST_DATABASE_URL && !process.env.DATABASE_URL) {
        throw new Error('No database URL found. Please set DATABASE_URL in your .env file');
    }
    logger_1.logger.info(`Using database: ${process.env.TEST_DATABASE_URL || process.env.DATABASE_URL}`);
    process.env.PYTHON_SERVICE_URL = 'http://localhost:8001';
    logger_1.logger.info('Starting E2E test setup...');
    try {
        yield prisma_1.prisma.$connect();
        logger_1.logger.info('Database connected for tests');
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to test database:', error);
        throw error;
    }
}));
beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.prisma.searchQuery.deleteMany();
    yield prisma_1.prisma.auditLog.deleteMany();
    yield prisma_1.prisma.embedding.deleteMany();
    yield prisma_1.prisma.chunk.deleteMany();
    yield prisma_1.prisma.document.deleteMany();
    yield prisma_1.prisma.groupMembership.deleteMany();
    yield prisma_1.prisma.group.deleteMany();
    yield prisma_1.prisma.organizationInvite.deleteMany();
    yield prisma_1.prisma.organizationMembership.deleteMany();
    yield prisma_1.prisma.refreshToken.deleteMany();
    yield prisma_1.prisma.userSession.deleteMany();
    yield prisma_1.prisma.organization.deleteMany();
    yield prisma_1.prisma.user.deleteMany();
    logger_1.logger.info('Database cleaned for test');
}));
afterAll(() => __awaiter(void 0, void 0, void 0, function* () {
    yield prisma_1.prisma.$disconnect();
    logger_1.logger.info('Test database disconnected');
}));
