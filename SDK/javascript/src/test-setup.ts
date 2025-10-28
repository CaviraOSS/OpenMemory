import { jest } from '@jest/globals'
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>