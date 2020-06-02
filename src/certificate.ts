import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";


const getDomainAndSubdomain = (domainName: string): { subdomain: string, parentDomain: string } => {
    const parts = domainName.split(".");
    if (parts.length < 2) {
        throw new Error(`No TLD found on ${domainName}`);
    }

    if (parts.length === 2) {
        return { subdomain: "", parentDomain: domainName };
    }

    const subdomain = parts[0];
    parts.shift();
    return {
        subdomain,
        parentDomain: parts.join(".") + ".",
    };
}


function createCertificate(domainName: string, parent?: pulumi.ComponentResource): aws.acm.Certificate {
    const eastRegion = new aws.Provider("east", {
        profile: aws.config.profile,
        region: "us-east-1", // Per AWS, ACM certificate must be in the us-east-1 region.
    }, {
        parent
    });

    const certificate = new aws.acm.Certificate("certificate", {
        domainName,
        validationMethod: "DNS",
    }, {
        parent,
        provider: eastRegion
    });

    const domainParts = getDomainAndSubdomain(domainName);
    const hostedZoneId = aws.route53.getZone({ name: domainParts.parentDomain }, { async: true }).then(zone => zone.zoneId);

    /**
     *  Create a DNS record to prove that we _own_ the domain we're requesting a certificate for.
     *  See https://docs.aws.amazon.com/acm/latest/userguide/gs-acm-validate-dns.html for more info.
     */
    const certificateValidationDomain = new aws.route53.Record(`${domainName}-validation`, {
        name: certificate.domainValidationOptions[0].resourceRecordName,
        zoneId: hostedZoneId,
        type: certificate.domainValidationOptions[0].resourceRecordType,
        records: [certificate.domainValidationOptions[0].resourceRecordValue],
        ttl: 600,
    }, {
        parent
    });

    /**
     * This is a _special_ resource that waits for ACM to complete validation via the DNS record
     * checking for a status of "ISSUED" on the certificate itself. No actual resources are
     * created (or updated or deleted).
     *
     * See https://www.terraform.io/docs/providers/aws/r/acm_certificate_validation.html for slightly more detail
     * and https://github.com/terraform-providers/terraform-provider-aws/blob/master/aws/resource_aws_acm_certificate_validation.go
     * for the actual implementation.
     */
    const certificateValidation = new aws.acm.CertificateValidation("certificateValidation", {
        certificateArn: certificate.arn,
        validationRecordFqdns: [certificateValidationDomain.fqdn],
    }, { parent, provider: eastRegion });

    return certificate;
}

export { createCertificate, getDomainAndSubdomain };
