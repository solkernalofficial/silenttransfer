// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SilentPrivateSend
 * @notice Atomic ETH private send: fund a one-time stealth address + ERC-5564 announce.
 * @dev Stealth address is derived off-chain (ERC-5564 ECDH). This contract only settles
 *      value + emits discovery material. Recipient privacy is cryptographic (only B can
 *      derive the spend key). Sender and amount remain visible on a public chain.
 */

interface IERC5564Messenger {
    function announce(
        uint256 schemeId,
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external;
}

contract SilentPrivateSend {
    uint256 public constant SCHEME_ID = 1;

    IERC5564Messenger public immutable messenger;

    event PrivateSend(
        address indexed sender,
        address indexed stealthAddress,
        uint256 amount,
        bytes ephemeralPubKey
    );

    error ZeroAddress();
    error ZeroValue();
    error EmptyKey();
    error FundFailed();

    constructor(address messenger_) {
        if (messenger_ == address(0)) revert ZeroAddress();
        messenger = IERC5564Messenger(messenger_);
    }

    /**
     * @param stealthAddress One-time address derived for the recipient (off-chain ECDH)
     * @param ephemeralPubKey Sender ephemeral public key R (for recipient scan)
     * @param metadata Optional ABI-encoded or raw metadata (token hints, view tag, etc.)
     */
    function sendEth(
        address stealthAddress,
        bytes calldata ephemeralPubKey,
        bytes calldata metadata
    ) external payable {
        if (stealthAddress == address(0)) revert ZeroAddress();
        if (msg.value == 0) revert ZeroValue();
        if (ephemeralPubKey.length == 0) revert EmptyKey();

        (bool ok, ) = stealthAddress.call{value: msg.value}("");
        if (!ok) revert FundFailed();

        // Announce from this contract; original sender is in PrivateSend event + metadata
        messenger.announce(SCHEME_ID, stealthAddress, ephemeralPubKey, metadata);

        emit PrivateSend(msg.sender, stealthAddress, msg.value, ephemeralPubKey);
    }
}
