from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/silenttransfer"

    # API
    api_port: int = 8000
    api_host: str = "0.0.0.0"

    # CORS
    cors_origins: str = "http://localhost:3000"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # SIWE
    siwe_domain: str = "localhost:3000"
    siwe_uri: str = "http://localhost:3000"

    # Environment: demo | testnet | mainnet
    environment: Literal["demo", "testnet", "mainnet"] = "testnet"

    # Legacy; prefer ENVIRONMENT=
    demo_mode: bool = False

    # Session JWT without SIWE (Alice/Bob console) — on for demo + testnet
    allow_operator_login: bool = True

    # Settlement simulation until bundler is wired
    simulate_settlement: bool = True

    # Chain — Robinhood Chain Testnet defaults
    rpc_url: str = "https://rpc.testnet.chain.robinhood.com"
    chain_id: int = 46630
    network_name: str = "Robinhood Chain Testnet"

    # Contract addresses
    registry_contract_address: str = ""
    messenger_contract_address: str = ""
    paymaster_contract_address: str = ""
    silent_token_address: str = ""
    vault_contract_address: str = ""
    shield_pool_address: str = ""

    protocol_fee_bps: int = 0
    # Vault private transfer fee (default 0.5% = 50 bps when vault is used)
    vault_fee_bps: int = 50

    bundler_url: str = ""
    paymaster_url: str = ""
    relayer_private_key: str = ""

    rate_limit_per_minute: int = 60
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}

    @property
    def is_demo(self) -> bool:
        return self.environment == "demo" or self.demo_mode

    @property
    def is_testnet(self) -> bool:
        return self.environment == "testnet"

    @property
    def operator_login_enabled(self) -> bool:
        if self.environment == "mainnet":
            return False
        return self.allow_operator_login or self.is_demo

    @property
    def settlement_mode(self) -> str:
        """
        demo — synthetic only
        testnet_simulated — API records claims without chain write
        live — RELAYER_PRIVATE_KEY + RPC broadcast real testnet txs
                (full ERC-4337 bundler is optional; BUNDLER_URL not required)
        """
        if self.is_demo:
            return "demo"
        if self.simulate_settlement:
            return "testnet_simulated"
        # Live when RPC is configured: funded claims use claim keys (relayer optional).
        if self.rpc_url:
            return "live"
        return "testnet_simulated"


settings = Settings()
