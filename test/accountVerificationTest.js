const { assert } = require("chai");
const { utils } = require("@aeternity/aeproject");
const { hash } = require("@aeternity/aepp-sdk");

const ACCOUNT_VERIFICATION_CONTRACT_SOURCE =
  "./contracts/AccountVerification.aes";

describe("AccountVerification", () => {
  let aeSdk;
  let contract;

  const userId = "USER_1";

  before(async () => {
    aeSdk = await utils.getSdk();
  });

  after(async () => {
    await utils.rollbackSnapshot(aeSdk);
  });

  it("init", async () => {
    contract = await aeSdk.initializeContract({
      sourceCode: utils.getContractContent(
        ACCOUNT_VERIFICATION_CONTRACT_SOURCE,
      ),
      fileSystem: utils.getFilesystem(ACCOUNT_VERIFICATION_CONTRACT_SOURCE),
    });

    const init = await contract.init();
    assert.equal(init.result.returnType, "ok");
  });

  it("verify_account", async () => {
    const signature = await aeSdk.sign(hash(`THE_BOT_VERIFIES_${userId}`));
    const verifyAccount = await contract.verify_account(userId, signature);
    assert.equal(verifyAccount.result.returnType, "ok");

    const differentSignature = await aeSdk.sign(hash(`OTHER_MSG_${userId}`));
    const verifyAccountFailure = await contract
      .verify_account(userId, differentSignature)
      .catch((e) => e.message);
    assert.include(verifyAccountFailure, "BOT_SIGNATURE_NOT_TRUSTED");
  });

  it("has_verified_account", async () => {
    const hasVerifiedAccount = await contract.has_verified_account(userId);
    assert.equal(hasVerifiedAccount.decodedResult, true);

    const hasVerifiedAccountUnknownUserId =
      await contract.has_verified_account("USER_2");
    assert.equal(hasVerifiedAccountUnknownUserId.decodedResult, false);
  });

  it("get_verified_account", async () => {
    const getVerifiedAccount = await contract.get_verified_account(userId);
    assert.equal(getVerifiedAccount.decodedResult, aeSdk.selectedAddress);

    const getVerifiedAccountUnknownUserId =
      await contract.get_verified_account("USER_2");
    assert.equal(getVerifiedAccountUnknownUserId.decodedResult, undefined);
  });

  it("remove_verified_account", async () => {
    const hasVerifiedAccount1 = await contract.has_verified_account(userId);
    assert.equal(hasVerifiedAccount1.decodedResult, true);

    const removeAccountFailure = await contract
      .remove_verified_account(userId, {
        onAccount: utils.getDefaultAccounts()[1],
      })
      .catch((e) => e.message);
    assert.include(removeAccountFailure, "USER_ID_NOT_MATCHING_CALLER");

    const hasVerifiedAccount2 = await contract.has_verified_account(userId);
    assert.equal(hasVerifiedAccount2.decodedResult, true);

    const removeAccount = await contract.remove_verified_account(userId);
    assert.equal(removeAccount.result.returnType, "ok");

    const hasVerifiedAccount3 = await contract.has_verified_account(userId);
    assert.equal(hasVerifiedAccount3.decodedResult, false);
  });
});
