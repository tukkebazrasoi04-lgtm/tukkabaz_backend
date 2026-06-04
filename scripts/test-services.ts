async function main() {
  const url = "https://tukkabaz-backend.onrender.com/catalog/services";
  console.log(`Fetching from ${url}...`);

  try {
    const response = await fetch(url);
    console.log("Response Status:", response.status, response.statusText);
    const text = await response.text();
    console.log("Response Body (truncated):", text.substring(0, 1000));
  } catch (error) {
    console.error("Fetch failed:", error);
  }
}

main();
