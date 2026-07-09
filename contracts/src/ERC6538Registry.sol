// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ERC6538Registry is Ownable, ReentrancyGuard {
    struct StealthMetaAddress {
        bytes spendingPubKey;
        bytes viewingPubKey;
    }

    mapping(address => StealthMetaAddress) private _registry;
    mapping(address => bool) private _kycStatus;
    mapping(address => uint256) private _registrationBlock;

    address public complianceOracle;

    event StealthMetaAddressRegistered(
        address indexed registrant,
        bytes spendingPubKey,
        bytes viewingPubKey,
        uint256 blockNumber
    );

    event StealthMetaAddressUpdated(
        address indexed registrant,
        bytes spendingPubKey,
        bytes viewingPubKey,
        uint256 blockNumber
    );

    event StealthMetaAddressCleared(address indexed registrant);

    event KYCStatusUpdated(address indexed registrant, bool status, address indexed oracle);

    event ComplianceOracleUpdated(address indexed oldOracle, address indexed newOracle);

    error InvalidKeyLength(string keyType);
    error AddressNotRegistered(address registrant);
    error ZeroAddress();

    modifier onlyOracle() {
        require(msg.sender == complianceOracle, "Caller is not the compliance oracle");
        _;
    }

    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        complianceOracle = initialOwner;
        emit ComplianceOracleUpdated(address(0), initialOwner);
    }

    function registerKeys(bytes calldata spendingPubKey, bytes calldata viewingPubKey)
        external
        nonReentrant
    {
        if (spendingPubKey.length != 64 && spendingPubKey.length != 65) {
            revert InvalidKeyLength("spendingPubKey must be 64 or 65 bytes");
        }
        if (viewingPubKey.length != 64 && viewingPubKey.length != 65) {
            revert InvalidKeyLength("viewingPubKey must be 64 or 65 bytes");
        }
        _registry[msg.sender] = StealthMetaAddress(spendingPubKey, viewingPubKey);
        _registrationBlock[msg.sender] = block.number;
        emit StealthMetaAddressRegistered(msg.sender, spendingPubKey, viewingPubKey, block.number);
    }

    function updateKeys(bytes calldata spendingPubKey, bytes calldata viewingPubKey)
        external
        nonReentrant
    {
        if (_registrationBlock[msg.sender] == 0) {
            revert AddressNotRegistered(msg.sender);
        }
        if (spendingPubKey.length != 64 && spendingPubKey.length != 65) {
            revert InvalidKeyLength("spendingPubKey must be 64 or 65 bytes");
        }
        if (viewingPubKey.length != 64 && viewingPubKey.length != 65) {
            revert InvalidKeyLength("viewingPubKey must be 64 or 65 bytes");
        }
        _registry[msg.sender] = StealthMetaAddress(spendingPubKey, viewingPubKey);
        _registrationBlock[msg.sender] = block.number;
        emit StealthMetaAddressUpdated(msg.sender, spendingPubKey, viewingPubKey, block.number);
    }

    function clearKeys() external nonReentrant {
        if (_registrationBlock[msg.sender] == 0) {
            revert AddressNotRegistered(msg.sender);
        }
        delete _registry[msg.sender];
        delete _registrationBlock[msg.sender];
        delete _kycStatus[msg.sender];
        emit StealthMetaAddressCleared(msg.sender);
    }

    function setKYCStatus(address registrant, bool status) external onlyOracle {
        _kycStatus[registrant] = status;
        emit KYCStatusUpdated(registrant, status, msg.sender);
    }

    function updateComplianceOracle(address newOracle) external onlyOwner {
        if (newOracle == address(0)) revert ZeroAddress();
        emit ComplianceOracleUpdated(complianceOracle, newOracle);
        complianceOracle = newOracle;
    }

    function getStealthMetaAddress(address registrant)
        external
        view
        returns (bytes memory spendingPubKey, bytes memory viewingPubKey)
    {
        StealthMetaAddress memory meta = _registry[registrant];
        return (meta.spendingPubKey, meta.viewingPubKey);
    }

    function isKYCCompliant(address registrant) external view returns (bool) {
        return _kycStatus[registrant];
    }

    function isRegistered(address registrant) external view returns (bool) {
        return _registrationBlock[registrant] != 0;
    }

    function getRegistrationBlock(address registrant) external view returns (uint256) {
        return _registrationBlock[registrant];
    }
}
