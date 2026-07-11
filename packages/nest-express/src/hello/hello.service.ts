import { Injectable } from "@nestjs/common";

@Injectable()
export class HelloService {
  greet(name: string, org: string): string {
    return `Hi ${name} from ${org}`;
  }
}
