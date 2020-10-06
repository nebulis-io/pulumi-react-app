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
            execSync(`(cd ${webappFolder} && rm -rf node_modules build package-lock.json && npm install --only=prod && ${packagedEnv} npm run build)`);
            return new pulumi.asset.AssetArchive({
                '.': new pulumi.asset.FileArchive(`${webappFolder}/build`)
            })
        }
    );

}
