package com.opesware.opesfuel.billing.momo;

/**
 * Cameroon MSISDN normalization and Mobile Money operator detection.
 * Cameroon mobile numbers are 9 digits starting with 6 (e.g. 6 7X XX XX XX), country code 237.
 */
public final class CameroonMsisdn {
    public enum Operator { MTN, ORANGE, UNKNOWN }

    private CameroonMsisdn() {}

    /** Returns the canonical 12-digit form "2376XXXXXXXX" (no plus), or throws if invalid. */
    public static String normalize(String raw) {
        if (raw == null) throw new IllegalArgumentException("Phone number is required.");
        String digits = raw.replaceAll("[^0-9]", "");
        if (digits.startsWith("00237")) digits = digits.substring(2);
        if (digits.length() == 9) digits = "237" + digits;
        if (digits.length() != 12 || !digits.startsWith("2376")) {
            throw new IllegalArgumentException("Invalid Cameroon mobile number: expected +237 6XX XX XX XX.");
        }
        return digits;
    }

    /** E.164 display form "+2376XXXXXXXX". */
    public static String e164(String raw) {
        return "+" + normalize(raw);
    }

    /** Local 9-digit subscriber number "6XXXXXXXX". */
    public static String local(String raw) {
        return normalize(raw).substring(3);
    }

    public static Operator detect(String raw) {
        String local = local(raw);
        int p2 = Integer.parseInt(local.substring(0, 2));
        int p3 = Integer.parseInt(local.substring(0, 3));
        if (p2 == 67 || (p3 >= 650 && p3 <= 654) || (p3 >= 680 && p3 <= 684)) return Operator.MTN;
        if (p2 == 69 || (p3 >= 655 && p3 <= 659) || (p3 >= 686 && p3 <= 689)) return Operator.ORANGE;
        return Operator.UNKNOWN;
    }
}
