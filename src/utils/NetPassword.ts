// Password of the remote net console and the KISS/TCP auth (--passwd). The node keeps at most 14
// characters, strips trailing spaces and treats the word "none" as "clear the password".

export const MAX_NET_PWD_CHARS = 14;

export interface NetPasswordCheck {
  ok: boolean,
  pwd: string,
  error: string
}

export const checkNetPassword = (input: string): NetPasswordCheck => {
  const pwd = input.trim();
  if (pwd === "") {
    return { ok: false, pwd, error: "Please enter a password." };
  }
  if (pwd.length > MAX_NET_PWD_CHARS) {
    return { ok: false, pwd, error: "The password can have max. " + MAX_NET_PWD_CHARS + " characters." };
  }
  if (pwd.toLowerCase() === "none") {
    return { ok: false, pwd, error: "\"none\" clears the password, use the RST button for that." };
  }
  return { ok: true, pwd, error: "" };
};
