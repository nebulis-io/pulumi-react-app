import { readdirSync, statSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";
import * as pulumi from "@pulumi/pulumi";

export const scanDirectory = (path: string): string[] => {
    let filePaths: string[] = []
    for (const item of readdirSync(path)) {
        const filePath = join(path, item);
        if (statSync(filePath).isDirectory()) {
            filePaths = filePaths.concat(scanDirectory(filePath));
        } else {
            filePaths.push(filePath)
        }
    }
    return filePaths;
}

export const packageReactWebapp = (webappFolder: string, env: { [name: string]: string | pulumi.Output<string> } = {}): pulumi.Output<pulumi.asset.AssetArchive> => {

    return pulumi.all(Object.values(env)).apply(values => values.map((value, idx) => `REACT_APP_${Object.keys(env)[idx]}="${value}"`).join(" ")).apply(
        packagedEnv => {
            execSync(`(cd ${webappFolder} && rm -rf build && yarn --prod && ${packagedEnv} yarn run build)`);
            return new pulumi.asset.AssetArchive({
                '.': new pulumi.asset.FileArchive(`${webappFolder}/build`)
            })
        }
    );

}

export const getDomainAndSubdomain = (domain: string | pulumi.Output<string>): pulumi.Output<{ subdomain: string, parentDomain: string }> => {
    return pulumi.output(domain).apply((domain: string) => {
        const parts = domain.split(".");
        if (parts.length < 2) {
            throw new Error(`No TLD found on ${domain}`);
        }
        if (parts.length === 2) {
            return { subdomain: "", parentDomain: domain };
        }
        const subdomain = parts[0];
        parts.shift();
        return {
            subdomain,
            parentDomain: parts.join(".") + ".",
        };
    })
}