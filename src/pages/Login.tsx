import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/theme-toggle";
import { Fingerprint, Server } from "lucide-react";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      await login(email, password);
      navigate("/");
    } catch (error) {
      setError("Invalid email or password. Try admin@example.com / user@example.com / msp@example.com with any password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-8">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="flex items-center mb-8">
        <img 
          src="/new-logo-transparent.png" 
          alt="Company Logo" 
          className="h-10 w-auto mr-3" 
        />
        <h1 className="text-3xl font-bold">Cloud Management</h1>
      </div>
      
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl text-center">Welcome back</CardTitle>
          <CardDescription className="text-center">
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>
        <Tabs defaultValue="email">
          <TabsList className="grid grid-cols-2 mx-6">
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="sso">SSO</TabsTrigger>
          </TabsList>
          <TabsContent value="email">
            <CardContent className="space-y-4 pt-4">
              <form onSubmit={handleLogin}>
                <div className="space-y-4">
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </TabsContent>
          <TabsContent value="sso">
            <CardContent className="pt-4">
              <div className="space-y-4">
                <p className="text-sm text-center text-muted-foreground">
                  Enterprise SSO login is available for configured tenants.
                </p>
                <Input placeholder="company-domain.com" />
                <Button className="w-full">Continue with SSO</Button>
              </div>
            </CardContent>
          </TabsContent>
        </Tabs>
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-center text-sm text-muted-foreground mt-4">
            <p>Demo credentials:</p>
            <p>admin@example.com (Admin)</p>
            <p>user@example.com (User)</p>
            <p>msp@example.com (MSP)</p>
            <p className="mt-1">Any password will work</p>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
