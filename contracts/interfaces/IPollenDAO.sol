// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IPollenDAO {
    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        address[] targets,
        uint256[] values,
        string[] signatures,
        bytes[] calldatas,
        uint256 startBlock,
        uint256 endBlock,
        string description
    );
    event ProposalExecuted(uint256 indexed proposalId);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);

    function votingPeriod() external view returns (uint256);
    function quorum() external view returns (uint256);
    function proposalThreshold() external view returns (uint256);
    function proposalCount() external view returns (uint256);
    function getProposal(uint256 proposalId) external view returns (
        address proposer,
        uint256 startBlock,
        uint256 endBlock,
        uint256 forVotes,
        uint256 againstVotes,
        bool executed
    );
    function state(uint256 proposalId) external view returns (uint8);
    function castVote(uint256 proposalId, uint8 support) external;
    function execute(uint256 proposalId) external;
} 