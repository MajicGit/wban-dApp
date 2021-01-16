import chai, { expect } from 'chai';
import { Contract, utils } from 'ethers';
import { deployContract, MockProvider, solidity } from 'ethereum-waffle';
import wBANToken from '../build/wBANToken.json';

chai.use(solidity);

describe('wBANToken', () => {
  const [owner, user1, user2] = new MockProvider().getWallets();
  let token: Contract;

  beforeEach(async () => {
    token = await deployContract(owner, wBANToken);
	});

	it('Keeps track of user deposits in BNB to cover owner fees', async () => {
		const user_deposit_amount = utils.parseEther('0.01');
		const user1_interaction = token.connect(user1);
		// make sure the BNB were received by the owner
		await expect(() => user1_interaction.bnbDeposit({ value: user_deposit_amount }))
			.to.changeEtherBalance(owner, user_deposit_amount);
		// make sure user deposits are registered
		expect(await token.bnbBalanceOf(user1.address)).to.equal(user_deposit_amount);
		// make sure that the BNBDeposit event was emitted
		await expect(user1_interaction.bnbDeposit({ value: user_deposit_amount }))
			.to.emit(token, 'BNBDeposit').withArgs(user1.address, user_deposit_amount);
	});

	it('Refuses to mint wBAN if user did not deposit enough BNB for owner fees', async () => {
		const wBanToMint = 123;
		// user did not deposit any BNB
		await expect(token.mint(user1.address, wBanToMint, 200_000, { gasLimit: 200_000 }))
			.to.be.revertedWith('Insufficient BNB deposited');
		// user did not deposit enough BNB
		const user1_interaction = token.connect(user1);
		await user1_interaction.bnbDeposit({ value: utils.parseEther('0.0001') });
		await expect(token.mint(user1.address, wBanToMint, 200_000, { gasLimit: 200_000 }))
			.to.be.revertedWith('Insufficient BNB deposited');
	});

	it('Refuses to mint if gas limit is zero', async () => {
		const wBanToMint = 123;
		const user1_interaction = token.connect(user1);
		await user1_interaction.bnbDeposit({ value: utils.parseEther('0.001') });
		await expect(token.mint(user1.address, wBanToMint, 0, { gasLimit: 200_000 }))
			.to.be.revertedWith("Gas limit can't be zero");
	});

	it('Mints wBAN if user deposited enough BNB', async () => {
		const wBanToMint = 123;
		const gasPrice = 20_000_000_000;
		const user1_interaction = token.connect(user1);
		await user1_interaction.bnbDeposit({ value: utils.parseEther('0.001') });
		// TODO: verify that the BNB balance of user1 is reduced due to gas costs from owner's transaction for mint
		await expect(token.mint(user1.address, wBanToMint, 45_470, { gasLimit: 77_000, gasPrice: gasPrice }))
			.to.emit(token, 'Fee').withArgs(user1.address, 45_470 * gasPrice);
		// make sure user was sent his wBAN
		expect(await token.balanceOf(user1.address)).to.equal(wBanToMint);
		// make sure total supply was changed
		expect(await token.totalSupply()).to.equal(wBanToMint);
	});

});
