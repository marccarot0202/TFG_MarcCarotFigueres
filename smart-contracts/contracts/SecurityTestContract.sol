// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SecurityTestContract
 * @dev Contrato de prueba para demostrar análisis de seguridad del Snap
 * Incluye funciones típicas que pueden ser peligrosas si no se entienden
 */
contract SecurityTestContract is ERC20, Ownable {
    
    // Mapping para tracking de aprobaciones
    mapping(address => mapping(address => uint256)) private _allowances;
    
    // Balance de ETH del contrato
    uint256 public contractBalance;
    
    // Eventos
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event ETHDeposited(address indexed from, uint256 amount);
    event ETHWithdrawn(address indexed to, uint256 amount);
    event DangerousApprovalMade(address indexed owner, address indexed spender, uint256 amount);
    
    constructor() ERC20("SecurityTest Token", "STT") {        // Mintear tokens iniciales al deployer (1 millón)
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }
    
    /**
     * @dev Función para recibir ETH
     */
    receive() external payable {
        contractBalance += msg.value;
        emit ETHDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Mintear tokens (solo owner)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }
    
    /**
     * @dev Quemar tokens propios
     */
    function burn(uint256 amount) public {
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }
    
    /**
     * @dev Depositar ETH en el contrato
     */
    function depositETH() public payable {
        require(msg.value > 0, "Debe enviar ETH");
        contractBalance += msg.value;
        emit ETHDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Retirar ETH del contrato (solo owner)
     */
    function withdrawETH(uint256 amount) public onlyOwner {
        require(amount <= contractBalance, "Fondos insuficientes");
        contractBalance -= amount;
        payable(owner()).transfer(amount);
        emit ETHWithdrawn(owner(), amount);
    }
    
    /**
     * @dev Aprobar gasto de tokens (PELIGROSO si es ilimitado)
     * Esta función es común en DeFi y puede ser explotada
     */
    function approveSpending(address spender, uint256 amount) public returns (bool) {
        _approve(msg.sender, spender, amount);
        
        // Detectar aprobaciones peligrosas (ilimitadas o muy grandes)
        if (amount >= type(uint256).max / 2) {
            emit DangerousApprovalMade(msg.sender, spender, amount);
        }
        
        return true;
    }
    
    /**
     * @dev Función "vulnerable" a propósito para demostración
     * Permite transferir tokens de cualquiera que haya aprobado
     */
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override returns (bool) {
        address spender = msg.sender;
        _spendAllowance(from, spender, amount);
        _transfer(from, to, amount);
        return true;
    }
    
    /**
     * @dev Ver balance de tokens de una dirección
     */
    function getTokenBalance(address account) public view returns (uint256) {
        return balanceOf(account);
    }
    
    /**
     * @dev Ver cuánto ETH tiene el contrato
     */
    function getContractETHBalance() public view returns (uint256) {
        return contractBalance;
    }
}