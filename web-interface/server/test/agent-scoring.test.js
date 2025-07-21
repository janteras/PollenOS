// Test file for agent scoring

// Mock the path module
jest.mock('path', () => ({
  join: jest.fn().mockReturnValue('/mock/db/path')
}));

// Create a mock database implementation
const createMockDb = () => {
  const mockDb = {
    run: jest.fn((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
      }
      if (typeof callback === 'function') {
        callback();
      }
      return { lastID: 1, changes: 1 };
    }),
    get: jest.fn((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
      }
      callback(null, { 
        rank: 5,
        total_participants: 100,
        pnl_30d: 5.5,
        sharpe_ratio_30d: 1.8,
        max_drawdown_30d: 12.3
      });
    }),
    all: jest.fn((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      
      if (query.includes('FROM bots') || query.includes('agent_scores')) {
        callback(null, [{
          bot_id: 'test-bot-1',
          name: 'Test Bot',
          overall_score: 85,
          risk_adjusted_score: 75,
          consistency_score: 90,
          strategy_score: 85,
          efficiency_score: 95,
          current_rank: 5,
          total_competitors: 100,
          pnl_30d: 5.5,
          sharpe_ratio_30d: 1.8,
          last_updated: '2023-01-01T00:00:00.000Z'
        }]);
      } else {
        callback(null, []);
      }
    }),
    exec: jest.fn((query, callback) => {
      if (typeof callback === 'function') {
        callback();
      }
    }),
    serialize: jest.fn((callback) => {
      if (typeof callback === 'function') {
        callback();
      }
      return mockDb;
    })
  };
  return mockDb;
};

// Create mock database instance
const mockDb = createMockDb();

// Mock sqlite3
const mockSqlite3 = {
  verbose: jest.fn(() => ({
    Database: jest.fn(() => mockDb)
  }))
};

// Mock the sqlite3 module
jest.mock('sqlite3', () => mockSqlite3);

// Mock the Pollen Virtual service
const mockPollenVirtualService = {
  calculateVirtualScore: jest.fn().mockResolvedValue(85),
  getBotRank: jest.fn().mockResolvedValue({ rank: 5, totalParticipants: 100 })
};

// Mock the Pollen Virtual service module
jest.mock('../services/pollen-virtual-service', () => ({
  __esModule: true,
  default: mockPollenVirtualService
}));

// Import the AgentScoring class and instance
const { AgentScoring, agentScoring: singletonInstance } = require('../analytics/agent-scoring');

// Create a test instance with the mock Pollen Virtual service
let agentScoring;

// Mock the helper methods
const mockHelperMethods = {
  calculateRiskAdjustedScore: jest.fn().mockResolvedValue(1.5),
  calculateConsistencyScore: jest.fn().mockResolvedValue(0.9),
  calculateStrategyAdherence: jest.fn().mockResolvedValue(0.85),
  calculateEfficiencyScore: jest.fn().mockResolvedValue(0.95),
  calculateMaxDrawdown: jest.fn().mockResolvedValue(0.1),
  getHistoricalReturns: jest.fn().mockResolvedValue([0.1, 0.05, -0.02, 0.03, 0.02])
};

describe('Agent Scoring System', () => {
  let agentScoring;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Create a new instance with the mock Pollen Virtual service
    agentScoring = new AgentScoring({
      pollenVirtualService: mockPollenVirtualService
    });
    
    // Set up the database instance
    agentScoring.db = mockDb;
    
    // Reset the mock implementations
    mockPollenVirtualService.calculateVirtualScore.mockResolvedValue(85);
    mockPollenVirtualService.getBotRank.mockResolvedValue({ rank: 5, totalParticipants: 100 });
    
    // Setup the mock helper methods
    Object.assign(agentScoring, mockHelperMethods);
    
    // Reset the database mocks
    mockDb.run.mockImplementation((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
      }
      if (typeof callback === 'function') {
        callback();
      }
      return { lastID: 1, changes: 1 };
    });
    
    mockDb.get.mockImplementation((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
      }
      callback(null, { 
        rank: 5,
        total_participants: 100,
        pnl_30d: 5.5,
        sharpe_ratio_30d: 1.8,
        max_drawdown_30d: 12.3
      });
    });
    
    mockDb.all.mockImplementation((query, params, callback) => {
      if (typeof params === 'function') {
        callback = params;
        params = [];
      }
      
      if (query.includes('FROM bots') || query.includes('agent_scores')) {
        callback(null, [{
          bot_id: 'test-bot-1',
          name: 'Test Bot',
          overall_score: 85,
          risk_adjusted_score: 75,
          consistency_score: 90,
          strategy_score: 85,
          efficiency_score: 95,
          current_rank: 5,
          total_competitors: 100,
          pnl_30d: 5.5,
          sharpe_ratio_30d: 1.8,
          last_updated: '2023-01-01T00:00:00.000Z'
        }]);
      } else {
        callback(null, []);
      }
    });
  });
  
  afterEach(() => {
    // Clean up mocks after each test
    jest.clearAllMocks();
  });

  describe('updateAgentScore', () => {
    it('should calculate and update agent score', async () => {
      // Setup mocks
      const runSpy = jest.spyOn(mockDb, 'run').mockImplementation((query, params, callback) => {
        if (typeof params === 'function') {
          callback = params;
        }
        if (typeof callback === 'function') {
          callback();
        }
        return { lastID: 1, changes: 1 };
      });

      // Mock the getHistoricalReturns to return some data
      agentScoring.getHistoricalReturns = jest.fn().mockResolvedValue([0.1, 0.05, -0.02, 0.03, 0.02]);
      
      // Execute the method
      await agentScoring.updateAgentScore('test-bot-1');
      
      // Verify the database run method was called to update the score
      expect(runSpy).toHaveBeenCalled();
      
      // Verify the Pollen Virtual service was called
      expect(mockPollenVirtualService.calculateVirtualScore).toHaveBeenCalledWith('test-bot-1');
      
      // Verify the helper methods were called with expected arguments
      expect(agentScoring.getHistoricalReturns).toHaveBeenCalledWith('test-bot-1');
      expect(agentScoring.calculateRiskAdjustedScore).toHaveBeenCalled();
      expect(agentScoring.calculateConsistencyScore).toHaveBeenCalled();
      expect(agentScoring.calculateStrategyAdherence).toHaveBeenCalledWith('test-bot-1');
      expect(agentScoring.calculateEfficiencyScore).toHaveBeenCalledWith('test-bot-1');
      expect(agentScoring.calculateMaxDrawdown).toHaveBeenCalled();
    });
  });

  describe('getAgentScores', () => {
    it('should retrieve agent scores from the database', async () => {
      // Execute the method
      const result = await agentScoring.getAgentScores();
      
      // Verify the response format
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      
      // Verify the response contains the expected data
      expect(result[0]).toMatchObject({
        bot_id: 'test-bot-1',
        name: 'Test Bot',
        overall_score: 85,
        current_rank: 5,
        total_competitors: 100,
        pnl_30d: 5.5,
        sharpe_ratio_30d: 1.8,
        risk_adjusted_score: 75,
        consistency_score: 90,
        strategy_score: 85,
        efficiency_score: 95
      });
      
      // Verify the database query was made with the expected SQL
      expect(mockDb.all).toHaveBeenCalledWith(
        expect.stringContaining('FROM bots'),
        [],
        expect.any(Function)
      );
    });
  });

  describe('getPollenVirtualScore', () => {
    it('should return the Pollen Virtual score', async () => {
      // Setup the mock to return a specific score
      mockPollenVirtualService.calculateVirtualScore.mockResolvedValueOnce(85);
      
      // Execute the method
      const score = await agentScoring.getPollenVirtualScore('test-bot-1');
      
      // Verify the result and that the service was called
      expect(score).toBe(85);
      expect(mockPollenVirtualService.calculateVirtualScore).toHaveBeenCalledWith('test-bot-1');
    });
    
    it('should return 0 if Pollen Virtual service throws an error', async () => {
      // Setup the mock to throw an error
      mockPollenVirtualService.calculateVirtualScore.mockRejectedValueOnce(new Error('Service unavailable'));
      
      // Execute the method
      const score = await agentScoring.getPollenVirtualScore('test-bot-1');
      
      // Verify the result and that the service was called
      expect(score).toBe(0);
      expect(mockPollenVirtualService.calculateVirtualScore).toHaveBeenCalledWith('test-bot-1');
    });
  });
});
