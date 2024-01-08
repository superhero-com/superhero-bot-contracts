const { utils, networks } = require("@aeternity/aeproject");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { CompilerHttp, hash } = require("@aeternity/aepp-sdk");

// add contract paths from base
const CONTRACTS = ["AccountVerification.aes"];

function generateSourceHashes() {
  const hashes = CONTRACTS.reduce((acc, contract) => {
    const source = fs.readFileSync("./contracts/" + contract, "utf-8");
    acc[contract] = Buffer.from(hash(source)).toString("base64");
    return acc;
  }, {});

  fs.writeFileSync(
    "./generated/source_hashes.json",
    JSON.stringify(hashes, null, 2),
  );
}

function writeAci(aci, contract) {
  fs.writeFileSync(
    `${__dirname}/../generated/${path.basename(contract, ".aes")}.aci.json`,
    JSON.stringify(aci, null, 2),
    "utf-8",
  );
}

async function generateBytecodeAci() {
  const aeSdk = await utils.getSdk();

  const bytecode_hashes = await CONTRACTS.reduce(
    async (promiseAcc, contract) => {
      const acc = await promiseAcc;
      const fileSystem = utils.getFilesystem("./contracts/" + contract);
      let sourceCode = utils.getContractContent("./contracts/" + contract);

      try {
        if (
          contract === "" // use for standalone contracts that might also be used from factory
        )
          sourceCode = sourceCode.replaceAll(
            `contract ${path.basename(contract, ".aes")}`,
            `main contract ${path.basename(contract, ".aes")}`,
          );
        if (
          contract === "" // use for interfaces that might also be initialized standalone
        )
          sourceCode = sourceCode.replaceAll(
            `contract interface ${path.basename(contract, ".aes")}`,
            `main contract ${path.basename(contract, ".aes")}`,
          );

        const compiled = await aeSdk.compilerApi.compileBySourceCode(
          sourceCode,
          fileSystem,
        );

        const compilerVersion = await aeSdk.compilerApi.version();
        if (!acc[compilerVersion]) acc[compilerVersion] = {};

        acc[compilerVersion][contract] = {
          hash: crypto
            .createHash("sha256")
            .update(compiled.bytecode)
            .digest("hex"),
          bytecode: compiled.bytecode,
        };

        writeAci(compiled.aci, contract);
      } catch (e) {
        console.log(
          "falling back to just aci generation without compilation for",
          contract,
        );

        const compilerHttp = new CompilerHttp(networks.devmode.compilerUrl);
        await compilerHttp
          .generateAciBySourceCode(sourceCode, fileSystem)
          .then((aci) => writeAci(aci, contract))
          .catch(console.error);
      }

      return acc;
    },
    Promise.resolve({}),
  );

  fs.writeFileSync(
    "./generated/bytecode_hashes.json",
    JSON.stringify(bytecode_hashes, null, 2),
    "utf-8",
  );
}

generateSourceHashes();
void generateBytecodeAci();
