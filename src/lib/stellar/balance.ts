import { Horizon } from "@stellar/stellar-sdk";

const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

const server = new Horizon.Server(HORIZON_URL);

export async function getNativeBalance(address: string): Promise<string> {
  const account = await server.loadAccount(address);
  const nativeBalance = account.balances.find(
    (balance) => balance.asset_type === "native",
  );

  return nativeBalance ? Number(nativeBalance.balance).toFixed(2) : "0.00";
}
