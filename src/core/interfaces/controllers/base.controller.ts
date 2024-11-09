import { Request, Response } from "../request-handler.interface";

/**
 * @class BaseController
 * @description Base controller implementing common controller functionality
 */
export abstract class BaseController {
    protected abstract execute(req: Request, res: Response): Promise<void>;
  
    /**
     * @method handleRequest
     * @description Template method for handling requests with error handling
     */
    public async handleRequest(req: Request, res: Response): Promise<void> {
      try {
        await this.execute(req, res);
      } catch (error) {
        // Implement error handling
        res.status(500).send({ error: 'Internal Server Error' });
      }
    }
  }